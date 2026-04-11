"""Code Operator node — LLM-backed job dispatch and PR management.

Uses ChatAnthropic (langchain-anthropic) for LLM calls, ensuring
LangSmith auto-tracing of prompts, completions, tool calls, and token counts.
Spec ref: §6.3, §6 Implementation Mandate, Phase 2 RFC — Track B
"""

import asyncio
import json
import logging
import time
from dataclasses import replace

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from ..llm import (
    CostTrackingCallback,
    accumulate_cost,
    create_llm,
    dicts_to_langchain,
    langchain_to_dicts,
    parse_claude_code_usage,
)
from ..memory import manage_message_history
from ..risk import classify_pr_risk
from ..state import SDLCState
from ..tools.github_client import GitHubClient
from ..tools.job_executor import JobExecutor, create_job_executor

logger = logging.getLogger(__name__)

POLL_INTERVAL = 15  # seconds
MAX_POLL_TIME = 1800  # 30 min (matches job timeout)

SYSTEM_PROMPT = """You are the Code Operator for the Trading Agent Platform.

## Your Role
You dispatch Claude Code Runner jobs to implement user stories. You manage the \
lifecycle: prepare the issue context, dispatch the job, monitor execution, detect \
the resulting PR, and report back to the Scrum Master.

## Current State
- Issue: #{issue_number}
- Issue Body: {issue_body_preview}
- Job execution: {job_execution_id}
- Retry count: {retry_count}/{max_retries}
- Previous failure: {test_failure_report}

## Rules
- Always include the full issue body when dispatching a job.
- If this is a retry, include the test failure context so Claude Code can make targeted fixes.
- After the job completes, verify a PR exists on the expected branch.
- If no PR exists but the job succeeded, create one.
- Report the PR URL back to the Scrum Master.
"""

TOOLS = [
    {
        "name": "dispatch_claude_code_job",
        "description": (
            "Start a Claude Code Runner job using the configured execution backend. "
            "Provide the issue number and body. The job will clone the repo, create "
            "a branch, write code, and push."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "issue_number": {"type": "integer"},
                "issue_body": {
                    "type": "string",
                    "description": "Full issue body with AC",
                },
                "retry_context": {
                    "type": "string",
                    "description": (
                        "If retrying, the specific failure details and what to fix. "
                        "Leave empty for first attempt."
                    ),
                },
            },
            "required": ["issue_number", "issue_body"],
        },
    },
    {
        "name": "poll_job_to_completion",
        "description": (
            "Poll a running Claude Code Runner job until it completes or times out. "
            "Polls every 15 seconds for up to 30 minutes. "
            "Returns the final status: Succeeded, Failed, or Timeout."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "execution_id": {
                    "type": "string",
                    "description": "Job execution ID from dispatch",
                },
            },
            "required": ["execution_id"],
        },
    },
    {
        "name": "find_pr_for_branch",
        "description": (
            "Check if a PR exists for a given branch name. "
            "Use after job completion to find the PR."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "branch": {
                    "type": "string",
                    "description": "Branch name, e.g. 'feat/issue-42'",
                },
            },
            "required": ["branch"],
        },
    },
    {
        "name": "create_pr",
        "description": (
            "Create a pull request from a branch. Use only if the job pushed code "
            "but didn't create a PR."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "body": {"type": "string"},
                "head": {
                    "type": "string",
                    "description": "Branch name",
                },
                "base": {
                    "type": "string",
                    "description": "Target branch (usually 'main')",
                },
            },
            "required": ["title", "body", "head", "base"],
        },
    },
    {
        "name": "get_pr_diff",
        "description": (
            "Fetch the unified diff of a PR to inspect what was changed."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {"type": "integer"},
            },
            "required": ["pr_number"],
        },
    },
]


def _extract_changed_files(pr) -> list[str]:
    """Extract changed file paths from a PR object."""
    return [f.filename for f in pr.get_files()]


async def _execute_tool(
    tool_name: str,
    tool_input: dict,
    github: GitHubClient,
    executor: JobExecutor,
    state: SDLCState,
) -> tuple[str, dict]:
    """Execute a single tool call. Returns (result_text, state_updates)."""
    state_updates: dict = {}

    if tool_name == "dispatch_claude_code_job":
        issue_num = tool_input["issue_number"]
        git_token = github.generate_installation_token()
        execution_id = await executor.dispatch(
            issue_number=issue_num,
            issue_body=tool_input["issue_body"],
            git_token=git_token,
            retry_context=tool_input.get("retry_context", ""),
        )
        state_updates["job_execution_id"] = execution_id
        return (
            f"Job dispatched: {execution_id}. "
            f"Use poll_job_to_completion to monitor progress.",
            state_updates,
        )

    elif tool_name == "poll_job_to_completion":
        execution_id = tool_input["execution_id"]
        start = time.time()
        status = "Running"
        execution_config = state.project_config.get("execution", {})
        poll_timeout_seconds = execution_config.get(
            "job_timeout_seconds", MAX_POLL_TIME
        )
        log_output = ""

        while status == "Running" and (time.time() - start) < poll_timeout_seconds:
            await asyncio.sleep(POLL_INTERVAL)
            status = await executor.get_status(execution_id)
            elapsed = int(time.time() - start)
            logger.info(f"Job {execution_id}: {status} ({elapsed}s elapsed)")

        if status == "Running":
            status = "Timeout"
            logger.warning(
                f"Job {execution_id} timed out after {poll_timeout_seconds}s"
            )

        try:
            if status != "Running":
                try:
                    log_output = await executor.get_logs(execution_id)
                except Exception as e:
                    logger.warning(
                        f"Failed to retrieve logs for {execution_id}: {e}"
                    )

            # Capture Claude Code token usage from job output (RFC §13.4.1)
            claude_code_usage = None
            if status == "Succeeded":
                cost_config = state.project_config.get("cost_control", {})
                claude_code_usage = parse_claude_code_usage(
                    log_output, cost_config
                )
                if claude_code_usage:
                    state_updates["_claude_code_usage"] = claude_code_usage
                    logger.info(
                        f"Claude Code usage captured: "
                        f"{claude_code_usage['input_tokens']}in/"
                        f"{claude_code_usage['output_tokens']}out "
                        f"(${claude_code_usage['cost_usd']})"
                    )
                else:
                    logger.warning(
                        f"Job {execution_id} succeeded but no usage.json found"
                    )
            if status in {"Failed", "Timeout"}:
                log_excerpt = (log_output or "").strip()[:1000]
                state_updates["error_context"] = {
                    "error_type": "job_execution_failure",
                    "error_message": (
                        f"Job {execution_id} {status.lower()}. "
                        f"Logs: {log_excerpt or 'unavailable'}"
                    ),
                    "agent": "code_operator",
                    "retry_count": state.retry_count,
                    "recoverable": status != "Timeout",
                }

            result_msg = f"Job {execution_id}: {status}"
            if claude_code_usage:
                result_msg += (
                    f" (Claude Code: {claude_code_usage['input_tokens']}in/"
                    f"{claude_code_usage['output_tokens']}out, "
                    f"${claude_code_usage['cost_usd']})"
                )

            return result_msg, state_updates
        finally:
            if status != "Running":
                await executor.cleanup(execution_id)

    elif tool_name == "find_pr_for_branch":
        branch = tool_input["branch"]
        pr = github.find_pr_for_branch(branch)
        if pr:
            changed_files = _extract_changed_files(pr)
            state_updates["pr_number"] = pr.number
            state_updates["pr_url"] = pr.html_url
            state_updates["pr_changed_files"] = changed_files
            state_updates["pr_risk_tier"] = classify_pr_risk(changed_files)
            state_updates["architect_review_passed"] = None
            state_updates["architect_review_report"] = ""
            state_updates["workflow_stage"] = "pr_created"
            return json.dumps(
                {
                    "found": True,
                    "number": pr.number,
                    "html_url": pr.html_url,
                    "title": pr.title,
                    "changed_files": changed_files,
                    "risk_tier": state_updates["pr_risk_tier"],
                }
            ), state_updates
        return json.dumps({"found": False, "branch": branch}), state_updates

    elif tool_name == "create_pr":
        pr = github.create_pr(
            title=tool_input["title"],
            body=tool_input["body"],
            head=tool_input["head"],
            base=tool_input["base"],
        )
        changed_files = _extract_changed_files(pr)
        state_updates["pr_number"] = pr.number
        state_updates["pr_url"] = pr.html_url
        state_updates["pr_changed_files"] = changed_files
        state_updates["pr_risk_tier"] = classify_pr_risk(changed_files)
        state_updates["architect_review_passed"] = None
        state_updates["architect_review_report"] = ""
        state_updates["workflow_stage"] = "pr_created"
        return json.dumps(
            {
                "created": True,
                "number": pr.number,
                "html_url": pr.html_url,
                "changed_files": changed_files,
                "risk_tier": state_updates["pr_risk_tier"],
            }
        ), state_updates

    elif tool_name == "get_pr_diff":
        diff = github.get_pr_diff(tool_input["pr_number"])
        return diff[:10000], state_updates  # Truncate large diffs

    else:
        return f"Unknown tool: {tool_name}", state_updates


async def code_operator_node(state: SDLCState) -> SDLCState:
    """LLM-backed Code Operator — dispatches jobs and manages PRs.

    Uses ChatAnthropic for LangSmith auto-tracing compliance (§6 mandate).
    """
    github = GitHubClient.from_state(state)
    executor = create_job_executor(state)

    issue_num = state.current_issue_number
    issue_body_preview = (state.current_issue_body or "")[:200]

    # Build context-aware system prompt
    system = SYSTEM_PROMPT.format(
        issue_number=issue_num or "None",
        issue_body_preview=issue_body_preview or "N/A",
        job_execution_id=state.job_execution_id or "None",
        retry_count=state.retry_count,
        max_retries=state.max_retries,
        test_failure_report=state.test_failure_report or "None",
    )

    # Manage history size before starting the agentic loop
    state_messages = state.messages.copy() if state.messages else []
    state_messages = await manage_message_history(state_messages)

    # Convert state dicts to LangChain messages for the agentic loop
    lc_messages: list = [SystemMessage(content=system)]
    lc_messages.extend(dicts_to_langchain(state_messages))

    # Seed the conversation with the task context
    lc_messages.append(
        HumanMessage(
            content=(
                f"Implement issue #{issue_num}. "
                f"Issue body:\n{state.current_issue_body or 'N/A'}\n\n"
                f"Expected branch: feat/issue-{issue_num}\n"
                f"{'Retry context: ' + state.test_failure_report if state.test_failure_report else 'First attempt.'}"
            )
        )
    )

    # Agentic loop — keep calling the LLM until it stops using tools
    max_iterations = 10
    accumulated_state_updates: dict = {}
    cost_config = state.project_config.get("cost_control", {})
    cost_callback = CostTrackingCallback("code_operator", cost_config)
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
                    tc["name"], tc["args"], github, executor, state
                )
                # Extract and accumulate Claude Code usage if present
                cc_usage = updates.pop("_claude_code_usage", None)
                if cc_usage:
                    cost_tracker = accumulate_cost(cost_tracker, cc_usage)
                accumulated_state_updates.update(updates)
            except Exception as e:
                logger.error(f"Tool {tc['name']} failed: {e}")
                result = f"Error: {str(e)}"
                # On dispatch failure, mark as coding_failed
                if tc["name"] == "dispatch_claude_code_job":
                    accumulated_state_updates["workflow_stage"] = "coding_failed"
                    accumulated_state_updates["error_context"] = {
                        "error_type": "job_dispatch_failure",
                        "error_message": str(e),
                        "agent": "code_operator",
                        "retry_count": state.retry_count,
                        "recoverable": True,
                    }

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

    # If no PR was found/created and no explicit failure, mark as coding_failed
    if (
        "workflow_stage" not in accumulated_state_updates
        and not accumulated_state_updates.get("pr_number")
    ):
        accumulated_state_updates["workflow_stage"] = "coding_failed"
        accumulated_state_updates["error_context"] = {
            "error_type": "no_pr_created",
            "error_message": "Code Operator completed without creating a PR",
            "agent": "code_operator",
            "retry_count": state.retry_count,
            "recoverable": True,
        }

    return replace(
        state,
        messages=output_messages,
        cost_tracker=cost_tracker,
        **accumulated_state_updates,
    )
