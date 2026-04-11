"""Test Lead node — LLM-backed AC validation and test execution.

Performs three validation layers:
1. Semantic AC analysis — compare PR diff against acceptance criteria
2. Mechanical test execution — trigger run-tests.yml workflow, read results
3. Financial invariant awareness — flag P1-P4 concerns in ledger/settlement code

Structured verdict: submit_verdict tool enforces canonical JSON schema.
Retry gate enforces escalation policy deterministically.

Uses ChatAnthropic (langchain-anthropic) for LLM calls, ensuring
LangSmith auto-tracing of prompts, completions, tool calls, and token counts.
Spec ref: §6.4, §6 Implementation Mandate, §11.2, Phase 2 RFC — Track C
"""

import json
import logging
from dataclasses import replace

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from ..llm import (
    CostTrackingCallback,
    accumulate_cost,
    create_llm,
    dicts_to_langchain,
    langchain_to_dicts,
)
from ..memory import manage_message_history
from ..risk import select_test_workflows
from ..state import SDLCState
from ..tools.github_client import GitHubClient

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Test Lead for the Trading Agent Platform.

## Your Role
You validate that pull requests meet their acceptance criteria and don't break \
existing functionality. You perform three types of validation:

1. SEMANTIC: Read the PR diff and compare against the acceptance criteria from the \
   linked issue. For each criterion, assess: COVERED, PARTIALLY_COVERED, or NOT_COVERED.

2. MECHANICAL: Trigger the test suite via GitHub Actions and read the results.

3. FINANCIAL INVARIANTS: If the PR touches ledger, settlement, or position code, \
   check for compliance with these invariants:
   - P1 Zero-sum: all ledger mutations must net to zero
   - P2 Fail-closed: settlement errors must roll back the entire transaction
   - P3 FIFO: exit trades deplete the oldest lot first
   - P4 Intent fence: only one active intent per strategy-pair

## Current PR
- PR #{pr_number}: {pr_title}
- Issue #{issue_number}
- Changed files: {changed_files_summary}

## Required Workflow
1. Fetch the PR diff (get_pr_diff)
2. Fetch the issue body to extract acceptance criteria (get_issue_acceptance_criteria)
3. Trigger the required test workflow(s) (trigger_test_workflow)
4. Wait for results (get_workflow_results) — poll until conclusion is not null
5. Analyze everything and call submit_verdict EXACTLY ONCE with structured results

## Rules
- You MUST call submit_verdict exactly once at the end with the full structured report.
- NEVER approve a PR that fails tests (test conclusion must be "success").
- NEVER approve a PR that violates financial invariants.
- Be specific in failure reports — "tests fail" is not useful. "test_ledger_zero_sum \
  fails because entry_lines INSERT doesn't include the offsetting debit" IS useful.
- For partially covered AC, explain what's missing and how to add it.
- If the PR doesn't touch financial code, mark invariants as NOT_APPLICABLE.
"""

TOOLS = [
    {
        "name": "get_pr_diff",
        "description": (
            "Fetch the unified diff of the PR. "
            "Returns changed files with line-level changes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"pr_number": {"type": "integer"}},
            "required": ["pr_number"],
        },
    },
    {
        "name": "get_issue_acceptance_criteria",
        "description": (
            "Fetch the linked issue body to extract acceptance criteria."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"issue_number": {"type": "integer"}},
            "required": ["issue_number"],
        },
    },
    {
        "name": "get_file_contents",
        "description": (
            "Read a specific file from the PR branch to understand "
            "context beyond the diff."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path relative to repo root",
                },
                "ref": {
                    "type": "string",
                    "description": "Branch name or commit SHA",
                },
            },
            "required": ["path", "ref"],
        },
    },
    {
        "name": "trigger_test_workflow",
        "description": (
            "Trigger test workflow(s) via GitHub Actions based on changed files. "
            "If workflow_name is omitted, this selects run-tests.yml, "
            "test-workforce.yml, or both."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {"type": "integer"},
                "workflow_name": {
                    "type": "string",
                    "description": (
                        "Optional explicit workflow file name"
                    ),
                },
            },
            "required": ["pr_number"],
        },
    },
    {
        "name": "get_workflow_results",
        "description": (
            "Check status and read logs of a GitHub Actions workflow run."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "run_id": {
                    "type": "integer",
                    "description": "Workflow run ID",
                },
            },
            "required": ["run_id"],
        },
    },
    {
        "name": "submit_verdict",
        "description": (
            "Submit the final validation verdict. You MUST call this tool exactly once "
            "at the end of your analysis. Provide structured results for each validation layer."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {"type": "integer"},
                "verdict": {
                    "type": "string",
                    "enum": ["PASS", "FAIL"],
                    "description": "Overall verdict: PASS or FAIL",
                },
                "criteria": {
                    "type": "array",
                    "description": "Per-criterion analysis from the issue AC",
                    "items": {
                        "type": "object",
                        "properties": {
                            "criterion": {
                                "type": "string",
                                "description": "The acceptance criterion text",
                            },
                            "status": {
                                "type": "string",
                                "enum": [
                                    "COVERED",
                                    "PARTIALLY_COVERED",
                                    "NOT_COVERED",
                                ],
                            },
                            "evidence": {
                                "type": "string",
                                "description": (
                                    "File/line references proving coverage"
                                ),
                            },
                        },
                        "required": ["criterion", "status", "evidence"],
                    },
                },
                "test_results": {
                    "type": "object",
                    "description": "Mechanical test results",
                    "properties": {
                        "workflow_run_id": {"type": "integer"},
                        "conclusion": {
                            "type": "string",
                            "enum": [
                                "success",
                                "failure",
                                "skipped",
                                "pending",
                            ],
                        },
                        "summary": {
                            "type": "string",
                            "description": "Brief test result summary",
                        },
                    },
                    "required": ["conclusion", "summary"],
                },
                "invariant_findings": {
                    "type": "array",
                    "description": (
                        "P1-P4 financial invariant findings "
                        "(empty array if not applicable)"
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "invariant": {
                                "type": "string",
                                "enum": [
                                    "P1_ZERO_SUM",
                                    "P2_FAIL_CLOSED",
                                    "P3_FIFO",
                                    "P4_INTENT_FENCE",
                                ],
                            },
                            "status": {
                                "type": "string",
                                "enum": [
                                    "OK",
                                    "VIOLATION",
                                    "NOT_APPLICABLE",
                                ],
                            },
                            "detail": {"type": "string"},
                        },
                        "required": ["invariant", "status"],
                    },
                },
                "failure_report": {
                    "type": "string",
                    "description": (
                        "On FAIL: specific, actionable report for Code Operator. "
                        "Reference files, line numbers, what to change. "
                        "Empty string on PASS."
                    ),
                },
            },
            "required": [
                "pr_number",
                "verdict",
                "criteria",
                "test_results",
                "invariant_findings",
                "failure_report",
            ],
        },
    },
]


def _validate_verdict(tool_input: dict) -> str | None:
    """Validate submit_verdict input against canonical schema.

    Returns None if valid, or an error string if invalid.
    """
    verdict = tool_input.get("verdict")
    if verdict not in ("PASS", "FAIL"):
        return f"Invalid verdict: {verdict}. Must be PASS or FAIL."

    criteria = tool_input.get("criteria")
    if not isinstance(criteria, list):
        return "criteria must be a list."

    for i, c in enumerate(criteria):
        if not isinstance(c, dict):
            return f"criteria[{i}] must be an object."
        for required in ("criterion", "status", "evidence"):
            if required not in c:
                return f"criteria[{i}] missing required field: {required}"
        if c["status"] not in ("COVERED", "PARTIALLY_COVERED", "NOT_COVERED"):
            return f"criteria[{i}].status invalid: {c['status']}"

    test_results = tool_input.get("test_results")
    if not isinstance(test_results, dict):
        return "test_results must be an object."
    if "conclusion" not in test_results or "summary" not in test_results:
        return "test_results missing conclusion or summary."

    invariants = tool_input.get("invariant_findings")
    if not isinstance(invariants, list):
        return "invariant_findings must be a list."

    if verdict == "FAIL" and not tool_input.get("failure_report"):
        return "FAIL verdict requires a non-empty failure_report."

    return None


async def _execute_tool(
    tool_name: str,
    tool_input: dict,
    github: GitHubClient,
    state: SDLCState,
) -> tuple[str, dict]:
    """Execute a single tool call. Returns (result_text, state_updates)."""
    state_updates: dict = {}

    if tool_name == "get_pr_diff":
        diff = github.get_pr_diff(tool_input["pr_number"])
        return diff[:15000], state_updates  # Truncate large diffs

    elif tool_name == "get_issue_acceptance_criteria":
        issue = github.get_issue(tool_input["issue_number"])
        return json.dumps(
            {
                "number": issue.number,
                "title": issue.title,
                "body": issue.body or "",
                "labels": [la.name for la in issue.labels],
            }
        ), state_updates

    elif tool_name == "get_file_contents":
        content = github.get_file_contents(
            tool_input["path"], tool_input["ref"]
        )
        return content[:10000], state_updates  # Truncate large files

    elif tool_name == "trigger_test_workflow":
        changed_files = state.pr_changed_files or github.get_pr_changed_files(
            tool_input["pr_number"]
        )
        explicit_workflow = tool_input.get("workflow_name")
        workflows = (
            [explicit_workflow]
            if explicit_workflow
            else select_test_workflows(changed_files)
        )

        run_ids: list[int] = []
        for workflow in workflows:
            run_ids.append(
                github.trigger_workflow(
                    workflow,
                    {"pr_number": str(tool_input["pr_number"])},
                )
            )

        state_updates["test_workflow_run_id"] = run_ids[0] if run_ids else None
        state_updates["test_workflow_run_ids"] = run_ids
        return (
            json.dumps(
                {
                    "workflows": workflows,
                    "run_ids": run_ids,
                    "changed_files": changed_files,
                }
            ),
            state_updates,
        )

    elif tool_name == "get_workflow_results":
        run_info = github.get_workflow_run(tool_input["run_id"])
        return json.dumps(run_info), state_updates

    elif tool_name == "submit_verdict":
        # Validate structured schema before accepting
        validation_error = _validate_verdict(tool_input)
        if validation_error:
            return (
                f"Schema validation failed: {validation_error}. "
                f"Fix the input and call submit_verdict again.",
                state_updates,
            )

        verdict = tool_input["verdict"]
        pr_num = tool_input["pr_number"]

        # Build structured ac_compliance from validated input
        ac_compliance = {
            "verdict": verdict,
            "criteria": tool_input["criteria"],
            "test_results": tool_input["test_results"],
            "invariant_findings": tool_input["invariant_findings"],
        }
        state_updates["ac_compliance"] = ac_compliance

        # Post the PR review to GitHub
        if verdict == "PASS":
            review_body = _format_review_body(tool_input)
            github.post_pr_review(pr_num, "APPROVE", review_body)
            state_updates["test_passed"] = True
            state_updates["test_failure_report"] = ""
            state_updates["workflow_stage"] = "tested"
        else:
            failure_report = tool_input["failure_report"]
            review_body = _format_review_body(tool_input)
            github.post_pr_review(pr_num, "REQUEST_CHANGES", review_body)
            state_updates["test_passed"] = False
            state_updates["test_failure_report"] = failure_report
            state_updates["workflow_stage"] = "test_failed"

        return f"Verdict submitted: {verdict}", state_updates

    else:
        return f"Unknown tool: {tool_name}", state_updates


def _format_review_body(verdict_input: dict) -> str:
    """Format the submit_verdict input into a human-readable PR review."""
    lines = [f"## Test Lead Verdict: {verdict_input['verdict']}\n"]

    lines.append("### Acceptance Criteria")
    for c in verdict_input.get("criteria", []):
        icon = {"COVERED": "+", "PARTIALLY_COVERED": "~", "NOT_COVERED": "-"}
        lines.append(
            f"  {icon.get(c['status'], '?')} [{c['status']}] {c['criterion']}"
        )
        if c.get("evidence"):
            lines.append(f"    Evidence: {c['evidence']}")

    tr = verdict_input.get("test_results", {})
    lines.append(
        f"\n### Test Results: {tr.get('conclusion', 'unknown')}"
    )
    if tr.get("summary"):
        lines.append(f"  {tr['summary']}")

    findings = verdict_input.get("invariant_findings", [])
    if findings:
        lines.append("\n### Financial Invariants")
        for f in findings:
            lines.append(f"  [{f['status']}] {f['invariant']}")
            if f.get("detail"):
                lines.append(f"    {f['detail']}")

    if verdict_input.get("failure_report"):
        lines.append(f"\n### Failure Report\n{verdict_input['failure_report']}")

    return "\n".join(lines)


async def test_lead_node(state: SDLCState) -> SDLCState:
    """LLM-backed Test Lead — validates PRs against acceptance criteria.

    Uses ChatAnthropic for LangSmith auto-tracing compliance (§6 mandate).
    """
    github = GitHubClient.from_state(state)

    pr_number = state.pr_number
    issue_number = state.current_issue_number

    # Get PR info for system prompt context
    pr_title = ""
    changed_files_summary = ""
    if pr_number:
        try:
            pr = github.get_pr(pr_number)
            pr_title = pr.title
            files = pr.get_files()
            changed_files_summary = ", ".join(
                f.filename for f in list(files)[:20]
            )
        except Exception as e:
            logger.warning(f"Could not fetch PR details: {e}")
            pr_title = "Unknown"
            changed_files_summary = "Unknown"

    # Build context-aware system prompt
    system = SYSTEM_PROMPT.format(
        pr_number=pr_number or "None",
        pr_title=pr_title,
        issue_number=issue_number or "None",
        changed_files_summary=changed_files_summary or "None",
    )

    # Manage history size before starting the agentic loop
    state_messages = state.messages.copy() if state.messages else []
    state_messages = await manage_message_history(state_messages)

    # Convert state dicts to LangChain messages for the agentic loop
    lc_messages: list = [SystemMessage(content=system)]
    lc_messages.extend(dicts_to_langchain(state_messages))

    # Seed the conversation with the validation task
    lc_messages.append(
        HumanMessage(
            content=(
                f"Validate PR #{pr_number} against the acceptance criteria "
                f"from issue #{issue_number}.\n\n"
                f"Steps:\n"
                f"1. Fetch the PR diff (get_pr_diff)\n"
                f"2. Fetch the issue AC (get_issue_acceptance_criteria)\n"
                f"3. Trigger the test workflow (trigger_test_workflow)\n"
                f"4. Wait for results (get_workflow_results)\n"
                f"5. Call submit_verdict ONCE with the full structured report"
            ),
        )
    )

    # Agentic loop
    max_iterations = 10
    accumulated_state_updates: dict = {}
    cost_config = state.project_config.get("cost_control", {})
    cost_callback = CostTrackingCallback("test_lead", cost_config)
    llm = create_llm(callbacks=[cost_callback])
    llm_with_tools = llm.bind_tools(TOOLS)
    cost_tracker = state.cost_tracker.copy() if state.cost_tracker else {}

    for _ in range(max_iterations):
        response: AIMessage = await llm_with_tools.ainvoke(lc_messages)

        lc_messages.append(response)

        if not response.tool_calls:
            break

        # Process tool calls
        for tc in response.tool_calls:
            try:
                result, updates = await _execute_tool(
                    tc["name"], tc["args"], github, state
                )
                accumulated_state_updates.update(updates)
            except Exception as e:
                logger.error(f"Tool {tc['name']} failed: {e}")
                result = f"Error: {str(e)}"

            lc_messages.append(
                ToolMessage(content=result, tool_call_id=tc["id"])
            )

    # Convert LangChain messages back to serializable dicts for state
    output_messages = langchain_to_dicts(
        [m for m in lc_messages if not isinstance(m, SystemMessage)]
    )

    # Accumulate callback-captured cost entries
    for entry in cost_callback.entries:
        cost_tracker = accumulate_cost(cost_tracker, entry)

    # Default: if no verdict was submitted, mark as failed
    if "test_passed" not in accumulated_state_updates:
        accumulated_state_updates["test_passed"] = False
        accumulated_state_updates["test_failure_report"] = (
            "Test Lead did not call submit_verdict."
        )
        accumulated_state_updates["workflow_stage"] = "test_failed"
        accumulated_state_updates["ac_compliance"] = {
            "verdict": "FAIL",
            "criteria": [],
            "test_results": {
                "conclusion": "skipped",
                "summary": "No verdict submitted",
            },
            "invariant_findings": [],
        }

    return replace(
        state,
        messages=output_messages,
        cost_tracker=cost_tracker,
        **accumulated_state_updates,
    )
