"""Product Owner node — roadmap decomposition and story creation.

Reads roadmap, functional spec, and architecture docs to generate user stories
with acceptance criteria, then creates GitHub issues and syncs to Linear.

Spec ref: AgenticSquad_Functional_Spec v3.0 §6.1
TRA-25: WF3-EPIC-01 Product Owner agent
"""

import json
import logging
from dataclasses import replace

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from ..config_loader import ensure_document_path_allowed, get_documents_for_persona
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

SYSTEM_PROMPT = """You are the Product Owner for the Trading Agent Platform's agentic workforce.

## Your Role
You translate roadmap phase objectives into actionable user stories with acceptance criteria.
You create issues in GitHub autonomously — you do NOT wait for human approval.

## Planning Direction
{planning_direction}

## Available Documents
{allowed_documents}

## Rules
- Read PRODUCT_ROADMAP.md, docs/specs/FUNCTIONAL_SPECIFICATION.md, and docs/specs/ARCHITECTURE.md \
  before creating stories.
- List existing open issues before creating new ones to avoid duplication.
- Every story MUST have:
  - User story format: "As a [role], I want [goal], so that [benefit]"
  - Testable, specific acceptance criteria
  - Traceability to roadmap exit criteria or Implementation Tracker IDs
  - Correct label taxonomy: phase/<n>, type/<category>
- Story size: target ≤300 lines of code change per story.
- NEVER read from docs/archive/ — this is strictly forbidden.
- After creating all issues, post a brief planning summary to Slack.
- Sync created issues to Linear via sync_to_linear.
"""

TOOLS = [
    {
        "name": "fetch_document",
        "description": (
            "Fetch a document from the repository. Use to read roadmap, specs, "
            "and architecture docs. Path must be relative to repo root."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": (
                        "Document path relative to repo root "
                        "(e.g., 'PRODUCT_ROADMAP.md', 'docs/specs/ARCHITECTURE.md')"
                    ),
                },
            },
            "required": ["path"],
        },
    },
    {
        "name": "get_repo_tree",
        "description": (
            "List files in a directory of the repository. "
            "Use to understand project structure."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Directory path (e.g., 'services/', 'frontend/src/')",
                },
            },
            "required": ["path"],
        },
    },
    {
        "name": "fetch_existing_issues",
        "description": (
            "Fetch existing open GitHub issues to check for duplicates "
            "before creating new ones."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "label_filter": {
                    "type": "string",
                    "description": "Optional label filter (e.g., 'phase/0')",
                },
            },
            "required": [],
        },
    },
    {
        "name": "create_github_issue",
        "description": (
            "Create a new GitHub issue with title, body (including AC), and labels. "
            "The body should include user story format and acceptance criteria."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Issue title — concise, action-oriented",
                },
                "body": {
                    "type": "string",
                    "description": (
                        "Issue body with user story, acceptance criteria, "
                        "and roadmap traceability"
                    ),
                },
                "labels": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Labels: phase/<n>, type/<category>, priority/<level>. "
                        "Always include 'status/ready-for-dev'."
                    ),
                },
            },
            "required": ["title", "body", "labels"],
        },
    },
    {
        "name": "sync_to_linear",
        "description": (
            "Create or sync a story to Linear for portfolio visibility."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
            },
            "required": ["title"],
        },
    },
    {
        "name": "post_to_slack",
        "description": (
            "Post a planning summary to Slack after creating issues."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "Planning summary message",
                },
            },
            "required": ["message"],
        },
    },
]


async def _execute_tool(
    tool_name: str,
    tool_input: dict,
    github: GitHubClient,
    slack: SlackClient,
    linear: LinearClient,
    state: SDLCState,
) -> tuple[str, dict]:
    """Execute a single PO tool call."""
    state_updates: dict = {}

    if tool_name == "fetch_document":
        path = tool_input["path"]
        try:
            ensure_document_path_allowed(path, persona="po")
        except ValueError as e:
            return str(e), state_updates
        try:
            content = github.get_file_contents(path, ref="main", persona="po")
            return content[:15000], state_updates
        except Exception as e:
            return f"Error fetching {path}: {e}", state_updates

    elif tool_name == "get_repo_tree":
        path = tool_input["path"]
        try:
            contents = github._repo.get_contents(path, ref="main")
            if isinstance(contents, list):
                tree = [
                    {"name": c.name, "type": c.type, "path": c.path}
                    for c in contents[:50]
                ]
            else:
                tree = [{"name": contents.name, "type": contents.type, "path": contents.path}]
            return json.dumps(tree), state_updates
        except Exception as e:
            return f"Error listing {path}: {e}", state_updates

    elif tool_name == "fetch_existing_issues":
        label = tool_input.get("label_filter", "")
        try:
            if label:
                issues = github.get_issues_by_label(label)
            else:
                issues = list(github._repo.get_issues(state="open"))
            return json.dumps(
                [
                    {
                        "number": i.number,
                        "title": i.title,
                        "labels": [la.name for la in i.labels],
                    }
                    for i in issues[:30]
                ]
            ), state_updates
        except Exception as e:
            return f"Error fetching issues: {e}", state_updates

    elif tool_name == "create_github_issue":
        title = tool_input["title"]
        body = tool_input["body"]
        labels = tool_input.get("labels", ["status/ready-for-dev"])
        try:
            issue = github._repo.create_issue(
                title=title, body=body, labels=labels
            )
            logger.info(f"PO created issue #{issue.number}: {title}")
            return json.dumps({
                "number": issue.number,
                "title": issue.title,
                "html_url": issue.html_url,
            }), state_updates
        except Exception as e:
            return f"Error creating issue: {e}", state_updates

    elif tool_name == "sync_to_linear":
        title = tool_input["title"]
        description = tool_input.get("description", "")
        if linear.enabled:
            try:
                result = linear.create_issue(title, description)
                issue_data = (
                    result.get("data", {})
                    .get("issueCreate", {})
                    .get("issue", {})
                )
                return json.dumps({
                    "synced": True,
                    "identifier": issue_data.get("identifier", ""),
                    "url": issue_data.get("url", ""),
                }), state_updates
            except Exception as e:
                return f"Linear sync failed (non-blocking): {e}", state_updates
        return "Linear sync disabled — skipped.", state_updates

    elif tool_name == "post_to_slack":
        await slack.post(tool_input["message"])
        return "Planning summary posted to Slack.", state_updates

    else:
        return f"Unknown tool: {tool_name}", state_updates


async def po_node(state: SDLCState) -> SDLCState:
    """LLM-backed Product Owner — decomposes roadmap into actionable stories."""
    github = GitHubClient.from_state(state)
    slack = SlackClient.from_state(state)
    linear = LinearClient()

    # TRA-27: Get persona-filtered document list
    allowed_docs_list: list[str] = []
    if state.document_registry:
        persona_docs = get_documents_for_persona(state.document_registry, "po")
        allowed_docs_list = [d["path"] for d in persona_docs]
    allowed_docs_str = "\n".join(f"- {p}" for p in allowed_docs_list) or "No registry loaded"

    system = SYSTEM_PROMPT.format(
        planning_direction=state.planning_direction or "No specific direction provided. Review the roadmap and create stories for the current phase.",
        allowed_documents=allowed_docs_str,
    )

    state_messages = state.messages.copy() if state.messages else []
    state_messages = await manage_message_history(state_messages)

    lc_messages: list = [SystemMessage(content=system)]
    lc_messages.extend(dicts_to_langchain(state_messages))

    # Seed with planning task
    direction = state.planning_direction or "Review the current roadmap phase and create stories."
    lc_messages.append(
        HumanMessage(
            content=(
                f"Planning direction: {direction}\n\n"
                "Steps:\n"
                "1. Read PRODUCT_ROADMAP.md to understand current phase objectives\n"
                "2. Read the functional spec and architecture spec for context\n"
                "3. Fetch existing issues to avoid duplicates\n"
                "4. Create well-structured GitHub issues with AC and traceability\n"
                "5. Sync each issue to Linear\n"
                "6. Post a planning summary to Slack"
            )
        )
    )

    max_iterations = 15
    accumulated_state_updates: dict = {}
    cost_config = state.project_config.get("cost_control", {})
    cost_callback = CostTrackingCallback("po", cost_config)
    llm = create_llm(callbacks=[cost_callback])
    llm_with_tools = llm.bind_tools(TOOLS)
    cost_tracker = state.cost_tracker.copy() if state.cost_tracker else {}

    for _ in range(max_iterations):
        response: AIMessage = await llm_with_tools.ainvoke(lc_messages)
        lc_messages.append(response)

        if not response.tool_calls:
            text = response.content
            if isinstance(text, str) and text.strip():
                await slack.post(text)
            break

        for tc in response.tool_calls:
            try:
                result, updates = await _execute_tool(
                    tc["name"], tc["args"], github, slack, linear, state
                )
                accumulated_state_updates.update(updates)
            except Exception as e:
                logger.error(f"PO tool {tc['name']} failed: {e}")
                result = f"Error: {str(e)}"

            lc_messages.append(
                ToolMessage(content=result, tool_call_id=tc["id"])
            )

    output_messages = langchain_to_dicts(
        [m for m in lc_messages if not isinstance(m, SystemMessage)]
    )

    for entry in cost_callback.entries:
        cost_tracker = accumulate_cost(cost_tracker, entry)

    # PO transitions back to idle (or done if this was a one-shot planning)
    accumulated_state_updates.setdefault("workflow_stage", "idle")

    return replace(
        state,
        messages=output_messages,
        cost_tracker=cost_tracker,
        **accumulated_state_updates,
    )
