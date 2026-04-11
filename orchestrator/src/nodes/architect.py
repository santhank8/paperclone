"""Architect node — strategic reviewer for high-risk PRs."""

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
from ..state import SDLCState
from ..tools.github_client import GitHubClient

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Architect for the Trading Agent Platform.

## Your Role
You perform strategic reviews for HIGH-RISK pull requests before testing.
This is not style/lint review. Focus on architectural direction and long-term
maintainability.

## Strategic Review Questions
- Does the change align with the current roadmap direction?
- Does it preserve service boundaries and architecture intent?
- Does it avoid introducing compounding technical debt?
- Is the approach the simplest viable design for this phase?

## Required Workflow
1. Read the PR diff (get_pr_diff)
2. Read the linked issue context (get_issue_context)
3. Call submit_architect_review exactly once with:
   - verdict: APPROVE or REQUEST_CHANGES
   - strategic_assessment: concrete rationale

## Rules
- Use REQUEST_CHANGES when strategic direction is wrong, even if tests might pass.
- Include concrete guidance in strategic_assessment.
- Do not wait for human confirmation.
"""

TOOLS = [
    {
        "name": "get_pr_diff",
        "description": "Fetch the unified PR diff for strategic review.",
        "input_schema": {
            "type": "object",
            "properties": {"pr_number": {"type": "integer"}},
            "required": ["pr_number"],
        },
    },
    {
        "name": "get_issue_context",
        "description": "Fetch linked issue title/body for intent and acceptance criteria context.",
        "input_schema": {
            "type": "object",
            "properties": {"issue_number": {"type": "integer"}},
            "required": ["issue_number"],
        },
    },
    {
        "name": "submit_architect_review",
        "description": (
            "Submit the strategic review outcome. Must be called exactly once."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {"type": "integer"},
                "verdict": {
                    "type": "string",
                    "enum": ["APPROVE", "REQUEST_CHANGES"],
                },
                "strategic_assessment": {"type": "string"},
            },
            "required": ["pr_number", "verdict", "strategic_assessment"],
        },
    },
]


def _format_review_body(tool_input: dict) -> str:
    return (
        "## Architect Strategic Review\n\n"
        f"**Verdict:** {tool_input['verdict']}\n\n"
        f"{tool_input['strategic_assessment']}"
    )


async def _execute_tool(
    tool_name: str,
    tool_input: dict,
    github: GitHubClient,
    state: SDLCState,
) -> tuple[str, dict]:
    """Execute a single Architect tool call."""
    state_updates: dict = {}

    if tool_name == "get_pr_diff":
        diff = github.get_pr_diff(tool_input["pr_number"])
        return diff[:15000], state_updates

    if tool_name == "get_issue_context":
        issue = github.get_issue(tool_input["issue_number"])
        return json.dumps(
            {
                "number": issue.number,
                "title": issue.title,
                "body": issue.body or "",
                "labels": [la.name for la in issue.labels],
            }
        ), state_updates

    if tool_name == "submit_architect_review":
        verdict = tool_input["verdict"]
        assessment = tool_input["strategic_assessment"].strip()
        pr_num = tool_input["pr_number"]
        if not assessment:
            return (
                "strategic_assessment cannot be empty. "
                "Call submit_architect_review again with rationale.",
                state_updates,
            )

        event = "APPROVE" if verdict == "APPROVE" else "REQUEST_CHANGES"
        github.post_pr_review(pr_num, event, _format_review_body(tool_input))

        if verdict == "APPROVE":
            state_updates["architect_review_passed"] = True
            state_updates["architect_review_report"] = assessment
            state_updates["workflow_stage"] = "architect_passed"
            return "Architect verdict submitted: APPROVE", state_updates

        state_updates["architect_review_passed"] = False
        state_updates["architect_review_report"] = assessment
        state_updates["workflow_stage"] = "coding_failed"
        state_updates["test_failure_report"] = (
            "Architect requested changes: " + assessment
        )
        return "Architect verdict submitted: REQUEST_CHANGES", state_updates

    return f"Unknown tool: {tool_name}", state_updates


async def architect_node(state: SDLCState) -> SDLCState:
    """LLM-backed Architect strategic review node."""
    github = GitHubClient.from_state(state)
    pr_number = state.pr_number
    issue_number = state.current_issue_number

    system = SYSTEM_PROMPT

    state_messages = state.messages.copy() if state.messages else []
    state_messages = await manage_message_history(state_messages)

    lc_messages: list = [SystemMessage(content=system)]
    lc_messages.extend(dicts_to_langchain(state_messages))
    lc_messages.append(
        HumanMessage(
            content=(
                f"Review high-risk PR #{pr_number} linked to issue #{issue_number}. "
                f"Call submit_architect_review exactly once."
            )
        )
    )

    max_iterations = 10
    accumulated_state_updates: dict = {}
    cost_config = state.project_config.get("cost_control", {})
    cost_callback = CostTrackingCallback("architect", cost_config)
    llm = create_llm(callbacks=[cost_callback])
    llm_with_tools = llm.bind_tools(TOOLS)
    cost_tracker = state.cost_tracker.copy() if state.cost_tracker else {}

    for _ in range(max_iterations):
        response: AIMessage = await llm_with_tools.ainvoke(lc_messages)
        lc_messages.append(response)

        if not response.tool_calls:
            break

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

    output_messages = langchain_to_dicts(
        [m for m in lc_messages if not isinstance(m, SystemMessage)]
    )

    for entry in cost_callback.entries:
        cost_tracker = accumulate_cost(cost_tracker, entry)

    # Fail closed if no explicit verdict was submitted.
    if "architect_review_passed" not in accumulated_state_updates:
        accumulated_state_updates["architect_review_passed"] = False
        accumulated_state_updates["architect_review_report"] = (
            "Architect did not submit a review verdict."
        )
        accumulated_state_updates["workflow_stage"] = "coding_failed"
        accumulated_state_updates["test_failure_report"] = (
            "Architect did not submit a review verdict."
        )

    return replace(
        state,
        messages=output_messages,
        cost_tracker=cost_tracker,
        **accumulated_state_updates,
    )
