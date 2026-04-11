"""Scrum Master node — LLM-backed orchestrator.

Uses ChatAnthropic (langchain-anthropic) for LLM calls, ensuring
LangSmith auto-tracing of prompts, completions, tool calls, and token counts.
Spec ref: §6.2, §6 Implementation Mandate, Phase 2 RFC — Track A
"""

import json
import logging
from dataclasses import replace

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from ..config_loader import (
    get_documents_for_persona,
    load_document_registry,
    DEFAULT_DOCUMENT_REGISTRY_PATH,
)
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
from ..tools.linear_client import LinearClient
from ..tools.slack_client import SlackClient

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Scrum Master for the Trading Agent Platform's agentic workforce.

## Your Role
You are the sole conversational interface between the human and the agent workforce.
ALL human messages come to you — commands, questions, status queries, approvals, and
natural conversation. You orchestrate the story lifecycle, answer questions, and keep
the human informed.

## Platform Overview
You manage the Trading Agent Platform — an Azure-native, low-frequency crypto trading
platform. The workforce consists of you and 5 specialist agents deployed as Azure
Container Apps. You have access to:
- **GitHub** (issues, PRs, code) via your tools
- **Infrastructure monitoring** via the Infra Lead (VPS, containers, NATS, PostgreSQL)
- **Linear** for project tracking
- **Slack** as the sole communication channel with the human

When the human asks what you manage, what infrastructure you oversee, or what the
platform is — answer directly from this context. Do NOT dispatch to other agents for
questions about your own capabilities or the platform overview.

## Current Workflow Stage: {workflow_stage}
## Current Issue: {current_issue_number}
## PR: {pr_number} ({pr_url})
## PR Risk Tier: {pr_risk_tier}
## Retry Count: {retry_count}/{max_retries}
## Test Failure Report: {test_failure_report}

## Intent Classification
Handle all human messages by classifying intent:
- **Issue pickup**: "pick up issue #N", "work on #N", "start #N" → call get_issue_details, \
assign_issue, then dispatch_to_code_operator. ALWAYS call check_budget first — if budget \
is exhausted, refuse and inform the human.
- **Status queries**: "status", "what's happening?" → use get_pr_status or describe current state.
- **Merge approval**: "merge", "ship it", "lgtm", "looks good" → call approve_merge \
(ONLY when workflow_stage is awaiting_merge_approval).
- **Budget queries**: "how's the budget?" → call check_budget.
- **Health check**: "ping" → respond that you are online.
- **Issue creation**: "open an issue", "create an issue", "file a bug" → call \
create_github_issue. Use details from conversation context (including information \
relayed by other agents) to populate the issue body.
- **General questions or conversation**: answer using your tools and knowledge.
{merge_gate_block}
## Workforce Awareness
You lead a team of 5 agents. Use the right agent for the job:
- **Code Operator** — code implementation, PR creation
- **Architect** — high-risk code review, architectural decisions
- **Test Lead** — test execution, AC validation, PR review
- **Infra Lead** — VPS health, container status, logs, deployments, system resources
- **PO** — story creation from roadmap (triggered by human direction)

When the human asks about infrastructure, VPS, container health, deployment status,
system resources, or service logs — dispatch to the Infra Lead. Do NOT say you lack
the capability. You are the orchestrator; delegate to the right agent.

## Dispatch Behavior Rules
- You are the ONLY interface to the human. NEVER tell the human to "contact DevOps",
  "reach out to the team", "escalate to someone", or check anything manually.
- When dispatching to another agent, do NOT post a "they're investigating" message.
  Stay silent until the agent returns with findings.
- When an agent returns results, post the ACTUAL findings to Slack. Include error
  messages, status codes, container names, and metrics. Do not paraphrase into
  vague summaries.
- If findings reveal a bug or config issue: create a GitHub issue to track the fix
  AND relay the findings to the human. Do both, do not ask permission.
- If findings require human action (e.g., SSH to update secrets that are not in the
  repo): tell the human exactly what to do with specific commands and paths.
- Do not ask "would you like me to escalate?" — just act. Relay, create issues,
  and inform the human what you did.

## Rules
- NEVER create or modify code. You orchestrate, you don't implement.
- NEVER tell the human to do something you have a tool for. If you can create an issue, \
post to Slack, check status, or dispatch to an agent — do it yourself. The human should \
never be asked to perform actions that are within your capabilities.
- NEVER tell the human to "contact" anyone or go to another channel. You are the sole \
interface between the human and the workforce (§8.2.1). All communication flows through you.
- NEVER pre-announce agent dispatches with "I'll check with X" and then ask permission. \
Just dispatch and report the result.
- Use your judgment to move work forward autonomously, including merge decisions.
- For protected-risk PRs, do not merge until explicit human decision is provided.
- Always keep the human informed via Slack.
- Track costs and respect budget limits.
- If something fails 3 times, escalate to human — don't keep retrying.
- When a story completes, write a brief outcome to persistent memory.
- When escalating due to repeated failures, write the failure analysis to lessons learned.
- Use conversation history to maintain context. When the human says "the issue" or \
"that problem", resolve the reference from prior messages — do not ask them to repeat.
"""

MERGE_GATE_BLOCK = """
## IMPORTANT: Merge Gate Active
A PR is awaiting human merge approval (protected-path PR).
- If the human is approving the merge (says "merge", "ship it", "lgtm", "looks good"), \
call the `approve_merge` tool.
- If they are asking a question or checking status, answer it using your other tools. \
Do NOT call approve_merge unless the human explicitly approves.
"""

TOOLS = [
    {
        "name": "get_open_issues",
        "description": (
            "Fetch GitHub issues labeled 'status/ready-for-dev', sorted by priority. "
            "Use when asked about available work or when picking the next story."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "label_filter": {
                    "type": "string",
                    "description": (
                        "Additional label to filter by (e.g., 'phase/0', 'priority/high'). "
                        "Optional — omit for all ready issues."
                    ),
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_issue_details",
        "description": (
            "Fetch full details of a specific GitHub issue by number. "
            "Returns title, body (with acceptance criteria), labels, and assignee."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "issue_number": {
                    "type": "integer",
                    "description": "GitHub issue number",
                },
            },
            "required": ["issue_number"],
        },
    },
    {
        "name": "assign_issue",
        "description": (
            "Mark an issue as in-progress. Adds 'status/in-progress' label and removes "
            "'status/ready-for-dev'. Use when starting work on a story."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "issue_number": {
                    "type": "integer",
                    "description": "Issue number to assign",
                },
            },
            "required": ["issue_number"],
        },
    },
    {
        "name": "dispatch_to_code_operator",
        "description": (
            "Send the current issue to the Code Operator for implementation. "
            "The Code Operator will dispatch a Claude Code Runner job. "
            "Use after assigning an issue."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "issue_number": {"type": "integer"},
                "issue_body": {
                    "type": "string",
                    "description": "Full issue body with AC",
                },
            },
            "required": ["issue_number", "issue_body"],
        },
    },
    {
        "name": "dispatch_to_test_lead",
        "description": (
            "Send the PR to the Test Lead for validation. "
            "The Test Lead will analyze AC compliance and trigger tests. "
            "Use after Code Operator creates a PR."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {"type": "integer"},
                "issue_number": {"type": "integer"},
            },
            "required": ["pr_number", "issue_number"],
        },
    },
    {
        "name": "merge_pr",
        "description": (
            "Merge a pull request into main when it is ready. "
            "Use autonomously once checks and review context indicate readiness."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {
                    "type": "integer",
                    "description": "PR number to merge",
                },
            },
            "required": ["pr_number"],
        },
    },
    {
        "name": "close_issue",
        "description": (
            "Close an issue and mark it done. Adds 'status/done' label. "
            "Use after the PR is merged."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "issue_number": {"type": "integer"},
            },
            "required": ["issue_number"],
        },
    },
    {
        "name": "get_pr_status",
        "description": (
            "Check the current status of a pull request — open, merged, checks status, "
            "review status. Use when asked about a PR or when checking progress."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {"type": "integer"},
            },
            "required": ["pr_number"],
        },
    },
    {
        "name": "post_to_slack",
        "description": (
            "Post a message to the #agent-workforce Slack channel. "
            "Use to report status, ask questions, or provide updates."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "Message text (supports Slack markdown)",
                },
            },
            "required": ["message"],
        },
    },
    {
        "name": "append_to_memory",
        "description": (
            "Append a learning or observation to a persistent memory document. "
            "Use for durable knowledge that future stories should benefit from. "
            "Examples: 'human prefers small PRs', 'ws-consumer tests need Redis mock', "
            "'LOT_SIZE errors require checking Binance filter API first'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "document": {
                    "type": "string",
                    "enum": ["LESSONS_LEARNED", "AGENT_MEMORY"],
                    "description": "Which document to append to",
                },
                "entry": {
                    "type": "string",
                    "description": (
                        "The memory entry. Be specific and actionable. "
                        "Include issue numbers, file paths, and concrete details."
                    ),
                },
            },
            "required": ["document", "entry"],
        },
    },
    {
        "name": "check_budget",
        "description": (
            "Check the current accumulated cost against budget thresholds. "
            "Returns budget status, total spent, and any threshold alerts."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "sync_to_linear",
        "description": (
            "Sync a story lifecycle event to Linear. Updates issue status and "
            "posts comments for PR links, test results, and reviews."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "event": {
                    "type": "string",
                    "enum": [
                        "story_picked_up",
                        "pr_created",
                        "architect_review",
                        "test_result",
                        "story_merged",
                        "deploy_verified",
                        "escalation",
                    ],
                    "description": "The lifecycle event to sync",
                },
                "issue_number": {
                    "type": "integer",
                    "description": "GitHub issue number",
                },
                "details": {
                    "type": "string",
                    "description": "Event details (PR URL, test result, etc.)",
                },
            },
            "required": ["event", "issue_number"],
        },
    },
    {
        "name": "read_linear_priority",
        "description": (
            "Read issue priority ordering from Linear to determine story pickup order."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "dispatch_to_infra_lead",
        "description": (
            "Route an infrastructure query to the Infra Lead agent. "
            "Use when the human asks about: VPS health, container status, "
            "service health, system resources (CPU/memory/disk), logs, "
            "deployment status, NATS streams, or any infrastructure concern. "
            "The Infra Lead has VPS MCP access and can inspect containers, "
            "check health endpoints, read logs, and query system stats."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "The infrastructure question to investigate. "
                        "Be specific — include service names if mentioned. "
                        "Examples: 'Check VPS health and container status', "
                        "'Get recent logs for ws-consumer', "
                        "'What is disk usage on app-01?'"
                    ),
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "approve_merge",
        "description": (
            "Approve a pending merge for a protected-risk PR that is awaiting "
            "human approval. Only call this when the human explicitly approves "
            "the merge (says 'merge', 'ship it', 'lgtm', 'looks good', etc.). "
            "Do NOT call this for status queries or other questions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "create_github_issue",
        "description": (
            "Create a new GitHub issue for operational defects, infrastructure "
            "problems, or other issues discovered during workforce operation. "
            "Use this when the human asks to open/create/file an issue, or when "
            "you identify a problem that needs tracking. Not limited to SDLC "
            "stories — can be used for any issue type."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Issue title — concise summary of the problem",
                },
                "body": {
                    "type": "string",
                    "description": (
                        "Issue body with details. Include: what happened, "
                        "error messages, affected services, and reproduction steps "
                        "if applicable. Use markdown formatting."
                    ),
                },
                "labels": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Labels to apply (e.g., 'bug', 'infrastructure', "
                        "'priority/high'). Optional."
                    ),
                },
            },
            "required": ["title", "body"],
        },
    },
]

# Map document enum values to file paths
_MEMORY_DOCUMENT_PATHS = {
    "LESSONS_LEARNED": "docs/LESSONS_LEARNED.md",
    "AGENT_MEMORY": "docs/AGENT_MEMORY.md",
}


def _check_budget(state: SDLCState) -> str:
    """Check accumulated cost against budget thresholds (TRA-28)."""
    cost_config = state.project_config.get("cost_control", {})
    monthly_budget = cost_config.get("monthly_budget_usd", 50.0)
    per_story_alert = cost_config.get("per_story_alert_usd", 2.0)
    total_cost = state.cost_tracker.get("total_cost_usd", 0.0)
    usage_pct = (total_cost / monthly_budget * 100) if monthly_budget > 0 else 0

    story_cost = sum(
        e.get("cost_usd", 0.0)
        for e in state.cost_tracker.get("entries", [])
        if e.get("agent") != "__previous_stories__"
    )

    return json.dumps({
        "total_cost_usd": round(total_cost, 4),
        "monthly_budget_usd": monthly_budget,
        "usage_percent": round(usage_pct, 1),
        "current_story_cost_usd": round(story_cost, 4),
        "per_story_alert_usd": per_story_alert,
        "story_alert_triggered": story_cost >= per_story_alert,
        "budget_remaining_usd": round(monthly_budget - total_cost, 4),
    })


async def _enforce_budget(
    state: SDLCState,
    slack: SlackClient,
    cost_tracker: dict,
) -> tuple[dict, list[float]]:
    """Check budget thresholds and return (state_updates, new_alerts_sent).

    TRA-28: After every node completes, check thresholds.
    - At each threshold crossing (50%, 80%, 95%), post Slack alert once.
    - At 100%, set workflow_stage = "budget_paused" if hard_stop_at_budget.
    """
    cost_config = state.project_config.get("cost_control", {})
    monthly_budget = cost_config.get("monthly_budget_usd", 50.0)
    thresholds = cost_config.get("alert_thresholds", [0.5, 0.8, 0.95])
    hard_stop = cost_config.get("hard_stop_at_budget", True)

    total_cost = cost_tracker.get("total_cost_usd", 0.0)
    usage_ratio = total_cost / monthly_budget if monthly_budget > 0 else 0

    alerts_sent = list(state.budget_alerts_sent)
    state_updates: dict = {}

    # Check threshold crossings
    for threshold in sorted(thresholds):
        if usage_ratio >= threshold and threshold not in alerts_sent:
            pct = int(threshold * 100)
            alerts_sent.append(threshold)
            try:
                await slack.post(
                    f"*Budget Alert ({pct}%)*: ${total_cost:.2f} / "
                    f"${monthly_budget:.2f} monthly budget consumed."
                )
            except Exception as e:
                logger.warning(f"Budget alert Slack post failed: {e}")

    # Hard stop at 100%
    if usage_ratio >= 1.0 and hard_stop:
        state_updates["workflow_stage"] = "budget_paused"
        logger.warning(
            f"Budget exhausted: ${total_cost:.2f} >= ${monthly_budget:.2f} — "
            "pausing workflow"
        )
        try:
            await slack.post(
                f"*Budget HARD STOP*: ${total_cost:.2f} / "
                f"${monthly_budget:.2f}. Workflow paused. "
                "No new stories will be picked up."
            )
        except Exception as e:
            logger.warning(f"Budget hard stop Slack post failed: {e}")

    return state_updates, alerts_sent


async def _execute_tool(
    tool_name: str,
    tool_input: dict,
    github: GitHubClient,
    slack: SlackClient,
    linear: LinearClient,
    state: SDLCState,
) -> tuple[str, dict]:
    """Execute a single tool call. Returns (result_text, state_updates)."""
    state_updates: dict = {}

    if tool_name == "get_open_issues":
        label = tool_input.get("label_filter", "status/ready-for-dev")
        issues = github.get_issues_by_label(label)
        return json.dumps(
            [
                {
                    "number": i.number,
                    "title": i.title,
                    "labels": [la.name for la in i.labels],
                }
                for i in issues[:10]
            ]
        ), state_updates

    elif tool_name == "get_issue_details":
        issue = github.get_issue(tool_input["issue_number"])
        return json.dumps(
            {
                "number": issue.number,
                "title": issue.title,
                "body": issue.body or "",
                "labels": [la.name for la in issue.labels],
                "state": issue.state,
            }
        ), state_updates

    elif tool_name == "assign_issue":
        num = tool_input["issue_number"]
        github.update_issue_labels(
            num, add=["status/in-progress"], remove=["status/ready-for-dev"]
        )
        state_updates["current_issue_number"] = num
        state_updates["workflow_stage"] = "dispatch_coding"
        return f"Issue #{num} assigned and labeled in-progress.", state_updates

    elif tool_name == "dispatch_to_code_operator":
        state_updates["workflow_stage"] = "dispatch_coding"
        state_updates["current_issue_number"] = tool_input["issue_number"]
        state_updates["current_issue_body"] = tool_input["issue_body"]
        return (
            f"Dispatching to Code Operator for issue #{tool_input['issue_number']}.",
            state_updates,
        )

    elif tool_name == "dispatch_to_test_lead":
        state_updates["workflow_stage"] = "dispatch_testing"
        return (
            f"Dispatching PR #{tool_input['pr_number']} to Test Lead.",
            state_updates,
        )

    elif tool_name == "merge_pr":
        pr_num = tool_input["pr_number"]
        github.merge_pr(pr_num)
        state_updates["workflow_stage"] = "merged"
        return f"PR #{pr_num} merged successfully.", state_updates

    elif tool_name == "close_issue":
        num = tool_input["issue_number"]
        github.update_issue_labels(
            num,
            add=["status/done"],
            remove=["status/in-progress", "status/in-review"],
        )
        github.close_issue(num)
        state_updates["workflow_stage"] = "done"
        return f"Issue #{num} closed with status/done.", state_updates

    elif tool_name == "get_pr_status":
        pr = github.get_pr(tool_input["pr_number"])
        return json.dumps(
            {
                "number": pr.number,
                "state": pr.state,
                "merged": pr.merged,
                "mergeable": pr.mergeable,
                "title": pr.title,
                "html_url": pr.html_url,
            }
        ), state_updates

    elif tool_name == "post_to_slack":
        await slack.post(tool_input["message"])
        return "Message posted to Slack.", state_updates

    elif tool_name == "append_to_memory":
        doc_path = _MEMORY_DOCUMENT_PATHS.get(tool_input["document"])
        if not doc_path:
            return f"Unknown document: {tool_input['document']}", state_updates
        result = github.append_to_document(doc_path, tool_input["entry"])
        return result, state_updates

    elif tool_name == "check_budget":
        return _check_budget(state), state_updates

    elif tool_name == "sync_to_linear":
        event = tool_input["event"]
        issue_num = tool_input["issue_number"]
        details = tool_input.get("details", "")
        identifier = f"TRA-{issue_num}"
        success = linear.sync_lifecycle_event_safe(
            event, identifier, details
        )
        status = "synced" if success else "failed (non-blocking)"
        return f"Linear sync {event} for #{issue_num}: {status}", state_updates

    elif tool_name == "read_linear_priority":
        if not linear.enabled:
            return "Linear sync disabled — using GitHub issue order.", state_updates
        try:
            issues = linear.get_priority_ordered_issues(status="Todo")
            if not issues:
                issues = linear.get_priority_ordered_issues(status="Backlog")
            result = json.dumps(
                [
                    {
                        "identifier": i["identifier"],
                        "title": i["title"],
                        "priority": i["priority"],
                    }
                    for i in issues[:10]
                ]
            )
            return result, state_updates
        except Exception as e:
            return f"Linear priority read failed (non-blocking): {e}", state_updates

    elif tool_name == "dispatch_to_infra_lead":
        query = tool_input["query"]
        state_updates["workflow_stage"] = "dispatch_infra_query"
        state_updates["infra_query"] = query
        return (
            f"Dispatching infrastructure query to Infra Lead: {query}",
            state_updates,
        )

    elif tool_name == "approve_merge":
        if state.workflow_stage != "awaiting_merge_approval":
            return (
                "Cannot approve merge — no PR is awaiting merge approval "
                f"(current stage: {state.workflow_stage})."
            ), state_updates
        state_updates["human_decision"] = "merge"
        return "Merge approved. Proceeding with merge.", state_updates

    elif tool_name == "create_github_issue":
        title = tool_input["title"]
        body = tool_input["body"]
        labels = tool_input.get("labels", [])
        issue = github.create_issue(title=title, body=body, labels=labels)
        return (
            f"Issue #{issue.number} created: {issue.html_url}\n"
            f"Title: {title}"
        ), state_updates

    else:
        return f"Unknown tool: {tool_name}", state_updates


async def scrum_master_node(state: SDLCState) -> SDLCState:
    """LLM-backed Scrum Master — interprets intent and selects tools.

    Uses ChatAnthropic for LangSmith auto-tracing compliance (§6 mandate).
    """
    github = GitHubClient.from_state(state)
    slack = SlackClient.from_state(state)
    linear = LinearClient()

    # TRA-27: Load document registry at startup, store in state
    document_registry = state.document_registry
    if not document_registry:
        try:
            document_registry = load_document_registry(
                str(DEFAULT_DOCUMENT_REGISTRY_PATH)
            )
        except FileNotFoundError:
            logger.warning("Document registry not found — persona filtering disabled")
            document_registry = {}

    # Build context-aware system prompt
    merge_gate = MERGE_GATE_BLOCK if state.workflow_stage == "awaiting_merge_approval" else ""
    system = SYSTEM_PROMPT.format(
        workflow_stage=state.workflow_stage,
        current_issue_number=state.current_issue_number or "None",
        pr_number=state.pr_number or "None",
        pr_url=state.pr_url or "N/A",
        pr_risk_tier=state.pr_risk_tier or "normal",
        retry_count=state.retry_count,
        max_retries=state.max_retries,
        test_failure_report=state.test_failure_report or "None",
        merge_gate_block=merge_gate,
    )

    # Manage history size before starting the agentic loop
    state_messages = state.messages.copy() if state.messages else []
    state_messages = await manage_message_history(state_messages)

    # Convert state dicts to LangChain messages for the agentic loop
    lc_messages: list = [SystemMessage(content=system)]
    lc_messages.extend(dicts_to_langchain(state_messages))

    # TRA-91 Fix 3: When IL returns findings, inject them as explicit context
    # so the SM's LLM knows to relay the actual data (not a vague summary).
    if state.workflow_stage == "infra_query_complete" and state.infra_query:
        # Extract IL's last AI message from state messages as the findings
        il_findings = ""
        for msg in reversed(state_messages):
            if msg.get("role") == "assistant" and msg.get("content"):
                il_findings = msg["content"]
                break
        lc_messages.append(
            HumanMessage(
                content=(
                    f"The Infra Lead has completed the infrastructure query: "
                    f"\"{state.infra_query}\"\n\n"
                    f"## Infra Lead Findings\n{il_findings}\n\n"
                    f"Post these findings to Slack VERBATIM — include all error "
                    f"messages, status codes, container names, and metrics. "
                    f"Do NOT paraphrase or soften. Do NOT say 'investigating' or "
                    f"ask 'would you like me to escalate?'. If the findings reveal "
                    f"errors or config issues, also create a GitHub issue to track "
                    f"the fix."
                )
            )
        )

    # Agentic loop — keep calling the LLM until it stops using tools
    max_iterations = 10
    accumulated_state_updates: dict = {}
    cost_config = state.project_config.get("cost_control", {})
    cost_callback = CostTrackingCallback("scrum_master", cost_config)
    llm = create_llm(callbacks=[cost_callback])
    llm_with_tools = llm.bind_tools(TOOLS)
    cost_tracker = state.cost_tracker.copy() if state.cost_tracker else {}

    for _ in range(max_iterations):
        response: AIMessage = await llm_with_tools.ainvoke(lc_messages)

        lc_messages.append(response)

        # If the LLM is done (no tool calls), extract the final text
        if not response.tool_calls:
            text = response.content
            if isinstance(text, str) and text.strip():
                await slack.post(text)
            break

        # Process tool calls
        for tc in response.tool_calls:
            try:
                result, updates = await _execute_tool(
                    tc["name"], tc["args"], github, slack, linear, state
                )
                accumulated_state_updates.update(updates)
            except Exception as e:
                logger.error(f"Tool {tc['name']} failed: {e}")
                result = f"Error: {str(e)}"

            lc_messages.append(
                ToolMessage(content=result, tool_call_id=tc["id"])
            )

    # Convert LangChain messages back to serializable dicts for state
    # Skip the SystemMessage (index 0) — it's rebuilt each invocation
    output_messages = langchain_to_dicts(
        [m for m in lc_messages if not isinstance(m, SystemMessage)]
    )

    # ── Deterministic memory writes on lifecycle events ──
    # These run outside the LLM loop to guarantee persistence.
    final_stage = accumulated_state_updates.get(
        "workflow_stage", state.workflow_stage
    )

    if final_stage in ("done", "merged"):
        try:
            issue_num = accumulated_state_updates.get(
                "current_issue_number", state.current_issue_number
            )
            pr_num = accumulated_state_updates.get(
                "pr_number", state.pr_number
            )
            entry = (
                f"Story #{issue_num} completed (PR #{pr_num}). "
                f"Stage: {final_stage}. Retries: {state.retry_count}."
            )
            github.append_to_document("docs/AGENT_MEMORY.md", entry)
            logger.info(f"Memory: wrote completion record for #{issue_num}")
        except Exception as e:
            logger.warning(f"Memory write failed (non-fatal): {e}")

    elif final_stage == "escalated":
        try:
            issue_num = accumulated_state_updates.get(
                "current_issue_number", state.current_issue_number
            )
            failure = (
                accumulated_state_updates.get("test_failure_report")
                or state.test_failure_report
                or "Unknown failure"
            )
            entry = (
                f"Story #{issue_num} escalated after "
                f"{state.retry_count} retries. "
                f"Last failure: {failure[:200]}"
            )
            github.append_to_document("docs/LESSONS_LEARNED.md", entry)
            logger.info(f"Memory: wrote escalation record for #{issue_num}")
        except Exception as e:
            logger.warning(f"Memory write failed (non-fatal): {e}")

    # TRA-91 Fix 3: Clear infra_query and reset to idle after relaying IL findings
    infra_query_cleared = ""
    if state.workflow_stage == "infra_query_complete":
        infra_query_cleared = ""  # Will be applied in replace() below
        # If the LLM didn't set a workflow_stage, default to idle
        if "workflow_stage" not in accumulated_state_updates:
            accumulated_state_updates["workflow_stage"] = "idle"
        logger.info("SM relayed Infra Lead findings, clearing infra_query")

    # Accumulate callback-captured cost entries
    for entry in cost_callback.entries:
        cost_tracker = accumulate_cost(cost_tracker, entry)

    # TRA-28: Enforce budget thresholds after node completion
    budget_updates, alerts_sent = await _enforce_budget(state, slack, cost_tracker)
    # Only apply budget_paused if we're not already in a terminal state
    if budget_updates.get("workflow_stage") == "budget_paused":
        if accumulated_state_updates.get("workflow_stage") not in (
            "done", "escalated", "merged"
        ):
            accumulated_state_updates.update(budget_updates)

    # TRA-27: Inject persona-filtered allowed documents for downstream nodes
    target_stage = accumulated_state_updates.get(
        "workflow_stage", state.workflow_stage
    )
    persona_map = {
        "dispatch_coding": "code_operator",
        "dispatch_testing": "test_lead",
        "dispatch_architect": "architect",
        "dispatch_infra_query": "infra_lead",
    }
    target_persona = persona_map.get(target_stage)
    allowed_docs: list[str] = []
    if target_persona and document_registry:
        persona_docs = get_documents_for_persona(document_registry, target_persona)
        allowed_docs = [d["path"] for d in persona_docs]

    # Apply accumulated state updates
    # TRA-91: Clear infra_query if we just relayed IL findings
    extra_updates: dict = {}
    if state.workflow_stage == "infra_query_complete":
        extra_updates["infra_query"] = ""

    return replace(
        state,
        messages=output_messages,
        cost_tracker=cost_tracker,
        document_registry=document_registry,
        allowed_documents=allowed_docs,
        budget_alerts_sent=alerts_sent,
        **extra_updates,
        **accumulated_state_updates,
    )
