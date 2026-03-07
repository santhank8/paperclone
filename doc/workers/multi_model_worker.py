#!/usr/bin/env python3
# Compatible with Python 3.9+
from __future__ import annotations

"""
Paperclip multi-model worker — process adapter agent runner.

Supports:
  - Any OpenAI-compatible /chat/completions endpoint (Alibaba DashScope, OpenAI, etc.)
  - Skill injection (PAPERCLIP_REQUIRED_SKILLS → SKILL.md prepended to system prompt)
  - Function calling / tool-use loop (up to MAX_TOOL_TURNS turns)
  - Role-aware user prompt framing (CEO/CTO/CPO/CSO/PM/Builder/QA/ReleaseOps)
  - Token usage reporting to Paperclip cost-events endpoint

Environment variables (injected by Paperclip process adapter):
  Required:  PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID, PAPERCLIP_AGENT_ID
  Optional:  PAPERCLIP_RUN_ID, PAPERCLIP_TASK_ID, PAPERCLIP_AGENT_NAME
             MODEL_NAME, MODEL_BASE_URL, MODEL_PROVIDER, MODEL_TEMPERATURE
             ALIBABA_API_KEY (or DASHSCOPE_API_KEY / OPENAI_API_KEY / etc.)
             AGENT_SYSTEM_PROMPT, PAPERCLIP_REQUIRED_SKILLS
             ENABLE_TOOL_USE (default: true), MAX_TOOL_TURNS (default: 10)
             AUTO_CLOSE_ISSUE (default: false)
"""

import datetime
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
MAX_TOOL_TURNS_DEFAULT = 10


# ─── Logging ─────────────────────────────────────────────────────────────────


def log(msg: str) -> None:
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


# ─── Env helpers ─────────────────────────────────────────────────────────────


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


# ─── Paperclip API client ────────────────────────────────────────────────────


def paperclip_request(
    method: str, path: str, api_url: str, api_key: str, run_id: str, payload=None
):
    url = api_url.rstrip("/") + path
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if run_id:
        headers["X-Paperclip-Run-Id"] = run_id

    req = urllib.request.Request(url, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        log(f"Paperclip API {method} {path} → {exc.code}: {body[:300]}")
        return {"error": exc.code, "body": body}


# ─── Issue helpers ────────────────────────────────────────────────────────────


def checkout_issue(
    issue_id: str, agent_id: str, api_url: str, api_key: str, run_id: str
):
    payload = {
        "agentId": agent_id,
        "expectedStatuses": ["todo", "backlog", "blocked", "in_progress"],
    }
    return paperclip_request(
        "POST", f"/api/issues/{issue_id}/checkout", api_url, api_key, run_id, payload
    )


def choose_issue(issues):
    if not issues:
        return None

    def key(issue):
        p = PRIORITY_ORDER.get(issue.get("priority", "medium"), 9)
        return (p, issue.get("createdAt", ""))

    return sorted(issues, key=key)[0]


# ─── Token extraction & cost reporting ───────────────────────────────────────


def extract_usage(resp_json):
    """Extract input/output/cached token counts from an OpenAI-compatible response."""
    usage = resp_json.get("usage") or {}
    input_tokens = int(
        usage.get("prompt_tokens", 0) or usage.get("input_tokens", 0) or 0
    )
    output_tokens = int(
        usage.get("completion_tokens", 0) or usage.get("output_tokens", 0) or 0
    )
    prompt_details = usage.get("prompt_tokens_details") or {}
    cached_tokens = int(
        prompt_details.get("cached_tokens", 0) or usage.get("cached_tokens", 0) or 0
    )
    return input_tokens, output_tokens, cached_tokens


def report_cost_event(
    api_url,
    api_key,
    run_id,
    company_id,
    agent_id,
    provider,
    model,
    input_tokens,
    output_tokens,
    cached_tokens,
):
    if input_tokens == 0 and output_tokens == 0 and cached_tokens == 0:
        return
    payload = {
        "agentId": agent_id,
        "provider": provider,
        "model": model,
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "cachedInputTokens": cached_tokens,
        "costCents": 0,
        "occurredAt": datetime.datetime.now(datetime.timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%S.000Z"
        ),
    }
    try:
        paperclip_request(
            "POST",
            f"/api/companies/{company_id}/cost-events",
            api_url,
            api_key,
            run_id,
            payload,
        )
        log(
            f"Cost event: in={input_tokens} out={output_tokens} cached={cached_tokens} "
            f"provider={provider} model={model}"
        )
    except Exception as exc:
        log(f"Warning: failed to report cost event: {exc}")


# ─── Paperclip tool definitions (function calling schema) ────────────────────


def build_tools(company_id: str, agent_id: str) -> list:
    """Return the OpenAI-compatible tools array for Paperclip API operations."""
    return [
        {
            "type": "function",
            "function": {
                "name": "paperclip_get_issue",
                "description": (
                    "Fetch full details of a Paperclip issue by ID, including its "
                    "project, goal, parent chain (ancestors), and current status."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "issue_id": {
                            "type": "string",
                            "description": "The UUID of the issue to fetch.",
                        }
                    },
                    "required": ["issue_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "paperclip_get_comments",
                "description": "Fetch all comments on a Paperclip issue.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "issue_id": {
                            "type": "string",
                            "description": "The UUID of the issue.",
                        }
                    },
                    "required": ["issue_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "paperclip_update_issue",
                "description": (
                    "Update a Paperclip issue. Can change status, priority, title, "
                    "description, assigneeAgentId, or add a comment simultaneously. "
                    "Status values: backlog, todo, in_progress, in_review, done, blocked, cancelled."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "issue_id": {
                            "type": "string",
                            "description": "The UUID of the issue to update.",
                        },
                        "status": {
                            "type": "string",
                            "enum": [
                                "backlog",
                                "todo",
                                "in_progress",
                                "in_review",
                                "done",
                                "blocked",
                                "cancelled",
                            ],
                            "description": "New status for the issue.",
                        },
                        "priority": {
                            "type": "string",
                            "enum": ["critical", "high", "medium", "low"],
                            "description": "New priority.",
                        },
                        "title": {"type": "string", "description": "New title."},
                        "description": {
                            "type": "string",
                            "description": "New description.",
                        },
                        "assigneeAgentId": {
                            "type": "string",
                            "description": (
                                "UUID of the agent to assign. Pass null to unassign from agents. "
                                "Use this to delegate work to another agent."
                            ),
                        },
                        "comment": {
                            "type": "string",
                            "description": "Optional comment body to post alongside the update.",
                        },
                    },
                    "required": ["issue_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "paperclip_add_comment",
                "description": "Post a markdown comment to a Paperclip issue.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "issue_id": {
                            "type": "string",
                            "description": "The UUID of the issue.",
                        },
                        "body": {
                            "type": "string",
                            "description": "Markdown content of the comment.",
                        },
                    },
                    "required": ["issue_id", "body"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "paperclip_create_issue",
                "description": (
                    "Create a new Paperclip issue. Use this to create subtasks, "
                    "delegate work to a specific agent, or decompose a parent issue."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Issue title."},
                        "description": {
                            "type": "string",
                            "description": "Issue description.",
                        },
                        "priority": {
                            "type": "string",
                            "enum": ["critical", "high", "medium", "low"],
                            "description": "Issue priority. Default: medium.",
                        },
                        "parentId": {
                            "type": "string",
                            "description": "UUID of the parent issue (required for subtasks).",
                        },
                        "assigneeAgentId": {
                            "type": "string",
                            "description": "UUID of the agent to assign this issue to.",
                        },
                        "projectId": {
                            "type": "string",
                            "description": "UUID of the project to attach this issue to.",
                        },
                        "goalId": {
                            "type": "string",
                            "description": "UUID of the goal this issue contributes to.",
                        },
                    },
                    "required": ["title"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "paperclip_list_agents",
                "description": (
                    "List all agents in this company. Use this to find the right agent "
                    "to assign or delegate work to."
                ),
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "paperclip_list_issues",
                "description": "List issues in this company, with optional status and assignee filters.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "string",
                            "description": (
                                "Comma-separated status filter, e.g. 'todo,in_progress'. "
                                "Omit to list all statuses."
                            ),
                        },
                        "assigneeAgentId": {
                            "type": "string",
                            "description": "Filter by assignee agent UUID.",
                        },
                    },
                    "required": [],
                },
            },
        },
    ]


# ─── Tool executor ────────────────────────────────────────────────────────────


def execute_tool(
    tool_name: str,
    tool_args: dict,
    api_url: str,
    api_key: str,
    run_id: str,
    company_id: str,
    agent_id: str,
) -> str:
    """Execute a Paperclip tool call and return result as a JSON string."""
    log(f"Tool call: {tool_name}({json.dumps(tool_args)})")

    try:
        if tool_name == "paperclip_get_issue":
            result = paperclip_request(
                "GET",
                f"/api/issues/{tool_args['issue_id']}",
                api_url,
                api_key,
                run_id,
            )

        elif tool_name == "paperclip_get_comments":
            result = paperclip_request(
                "GET",
                f"/api/issues/{tool_args['issue_id']}/comments",
                api_url,
                api_key,
                run_id,
            )

        elif tool_name == "paperclip_update_issue":
            # Copy first to avoid mutating the original tool_args dict (G1 fix)
            args = dict(tool_args)
            issue_id = args.pop("issue_id")
            result = paperclip_request(
                "PATCH",
                f"/api/issues/{issue_id}",
                api_url,
                api_key,
                run_id,
                args,
            )

        elif tool_name == "paperclip_add_comment":
            result = paperclip_request(
                "POST",
                f"/api/issues/{tool_args['issue_id']}/comments",
                api_url,
                api_key,
                run_id,
                {"body": tool_args["body"]},
            )

        elif tool_name == "paperclip_create_issue":
            tool_args.setdefault("companyId", company_id)
            result = paperclip_request(
                "POST",
                f"/api/companies/{company_id}/issues",
                api_url,
                api_key,
                run_id,
                tool_args,
            )

        elif tool_name == "paperclip_list_agents":
            result = paperclip_request(
                "GET",
                f"/api/companies/{company_id}/agents",
                api_url,
                api_key,
                run_id,
            )

        elif tool_name == "paperclip_list_issues":
            params = {}
            if tool_args.get("status"):
                params["status"] = tool_args["status"]
            if tool_args.get("assigneeAgentId"):
                params["assigneeAgentId"] = tool_args["assigneeAgentId"]
            qs = ("?" + urllib.parse.urlencode(params)) if params else ""
            result = paperclip_request(
                "GET",
                f"/api/companies/{company_id}/issues{qs}",
                api_url,
                api_key,
                run_id,
            )

        else:
            result = {"error": f"Unknown tool: {tool_name}"}

        return json.dumps(result, default=str)

    except Exception as exc:
        log(f"Tool error ({tool_name}): {exc}")
        return json.dumps({"error": str(exc)})


# ─── Model API (with tool-use loop) ──────────────────────────────────────────


def resolve_model_api_key() -> str:
    candidates = [
        "MODEL_API_KEY",
        "ALIBABA_API_KEY",
        "DASHSCOPE_API_KEY",
        "GROQ_API_KEY",
        "XAI_API_KEY",
        "MINIMAX_API_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
    ]
    for name in candidates:
        v = os.getenv(name, "").strip()
        if v:
            return v
    raise RuntimeError(
        "Missing model API key. Set MODEL_API_KEY or one of: "
        + ", ".join(candidates[1:])
    )


def model_chat(messages: list, tools: list | None = None) -> dict:
    """Single /chat/completions call. Returns the raw response JSON."""
    model_name = env_required("MODEL_NAME")
    model_base_url = env_required("MODEL_BASE_URL")
    model_api_key = resolve_model_api_key()
    temperature = float(os.getenv("MODEL_TEMPERATURE", "0.2"))
    timeout_sec = int(os.getenv("MODEL_TIMEOUT_SEC", "120"))

    body: dict = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
    }
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"

    url = model_base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {model_api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    extra_headers_json = os.getenv("MODEL_EXTRA_HEADERS_JSON", "").strip()
    if extra_headers_json:
        try:
            extra = json.loads(extra_headers_json)
            if isinstance(extra, dict):
                headers.update({str(k): str(v) for k, v in extra.items()})
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid MODEL_EXTRA_HEADERS_JSON: {exc}")

    req = urllib.request.Request(
        url,
        method="POST",
        headers=headers,
        data=json.dumps(body).encode("utf-8"),
    )
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_agent_loop(
    system_prompt: str,
    user_prompt: str,
    tools: list,
    api_url: str,
    api_key: str,
    run_id: str,
    company_id: str,
    agent_id: str,
    enable_tool_use: bool,
) -> tuple[str, int, int, int]:
    """
    Run the agentic tool-use loop.

    Returns: (final_text_output, total_input_tokens, total_output_tokens, total_cached_tokens)
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    total_in = total_out = total_cached = 0
    max_turns = int(os.getenv("MAX_TOOL_TURNS", str(MAX_TOOL_TURNS_DEFAULT)))
    active_tools = tools if enable_tool_use else None

    for turn in range(max_turns + 1):
        resp = model_chat(messages, tools=active_tools)

        # Accumulate token usage
        inp, out, cached = extract_usage(resp)
        total_in += inp
        total_out += out
        total_cached += cached

        choices = resp.get("choices", [])
        if not choices:
            log("Warning: model returned no choices")
            break

        choice = choices[0]
        finish_reason = choice.get("finish_reason", "stop")
        message = choice.get("message", {})

        # Append assistant message to history
        messages.append(message)

        # Check for tool calls
        tool_calls = message.get("tool_calls") or []

        if not tool_calls or finish_reason == "stop":
            # Done — extract final text
            content = message.get("content", "") or ""
            if isinstance(content, list):
                content = "\n".join(
                    item.get("text", "") for item in content if isinstance(item, dict)
                ).strip()
            return content.strip(), total_in, total_out, total_cached

        if turn >= max_turns:
            log(f"Reached max tool turns ({max_turns}), forcing stop")
            content = message.get("content", "") or "Agent reached tool-turn limit."
            if isinstance(content, list):
                content = "\n".join(
                    item.get("text", "") for item in content if isinstance(item, dict)
                ).strip()
            return content.strip(), total_in, total_out, total_cached

        # Execute each tool call and append results
        log(f"Turn {turn + 1}: executing {len(tool_calls)} tool call(s)")
        for tc in tool_calls:
            tc_id = tc.get("id", "")
            fn = tc.get("function", {})
            tool_name = fn.get("name", "")
            try:
                tool_args = json.loads(fn.get("arguments", "{}"))
            except json.JSONDecodeError:
                tool_args = {}

            tool_result = execute_tool(
                tool_name,
                tool_args,
                api_url,
                api_key,
                run_id,
                company_id,
                agent_id,
            )

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc_id,
                    "content": tool_result,
                }
            )

    return "No output produced.", total_in, total_out, total_cached


# ─── Role-aware user prompt framing ──────────────────────────────────────────

ROLE_FRAMING = {
    "ceo": (
        "You are performing a CEO heartbeat inside Paperclip.\n\n"
        "Use the available tools to:\n"
        "1. Read the full issue context and any relevant comments\n"
        "2. Form your strategic decision or direction\n"
        "3. Delegate to the correct lane owner (CTO/CPO/CSO/PM) by creating a subtask "
        "or reassigning via paperclip_update_issue\n"
        "4. Post a final comment with your Status/Evidence/Risks/Next action/Escalation output\n\n"
        "Act. Do not just describe what you would do."
    ),
    "cto": (
        "You are performing a CTO heartbeat inside Paperclip.\n\n"
        "Use the available tools to:\n"
        "1. Read the issue and its parent context\n"
        "2. Decompose the work into technical subtasks if needed\n"
        "3. Assign implementation work to BuilderEngineer via paperclip_create_issue or "
        "paperclip_update_issue\n"
        "4. Post a final comment with your Status/Evidence/Risks/Next action/Escalation output\n\n"
        "Act. Do not just describe what you would do."
    ),
    "cpo": (
        "You are performing a CPO heartbeat inside Paperclip.\n\n"
        "Use the available tools to:\n"
        "1. Read the issue and understand the user-facing scope\n"
        "2. Define acceptance criteria and UX expectations in comments\n"
        "3. Update the issue description if acceptance criteria are missing\n"
        "4. Post a final comment with your Status/Evidence/Risks/Next action/Escalation output\n\n"
        "Act. Do not just describe what you would do."
    ),
    "cso": (
        "You are performing a CSO heartbeat inside Paperclip.\n\n"
        "Use the available tools to:\n"
        "1. Read the issue and assess security/privacy risk\n"
        "2. Comment with risk classification and required controls\n"
        "3. Block the issue if unsafe (paperclip_update_issue status=blocked)\n"
        "4. Post a final comment with your Status/Evidence/Risks/Next action/Escalation output\n\n"
        "Act. Do not just describe what you would do."
    ),
    "pm": (
        "You are performing a PM heartbeat inside Paperclip.\n\n"
        "Use the available tools to:\n"
        "1. Read the issue, its context, and current comments\n"
        "2. Break it into subtasks if needed via paperclip_create_issue\n"
        "3. Assign subtasks to the right agents via assigneeAgentId\n"
        "4. Post a final comment with your Status/Evidence/Risks/Next action/Escalation output\n\n"
        "Act. Do not just describe what you would do."
    ),
    "builder": (
        "You are performing a Builder Engineer heartbeat inside Paperclip.\n\n"
        "Use the available tools to:\n"
        "1. Read the issue details, touch list, and done criteria from the description and comments\n"
        "2. Attach explicit evidence: list every file changed, every test run, and the exact "
        "output of `pnpm -r typecheck && pnpm test:run`. If you cannot run tests, state why.\n"
        "3. Update issue to done when all criteria are met and evidence is attached; "
        "update to blocked (with a specific reason) if anything prevents completion\n"
        "4. Post a final comment with your Status/Evidence/Risks/Next action/Escalation output\n\n"
        "Act. Do not just describe what you would do."
    ),
    "qa": (
        "You are performing a QA Engineer heartbeat inside Paperclip.\n\n"
        "Use the available tools to:\n"
        "1. Read the issue and ALL comments, including Builder's evidence bundle\n"
        "2. Find acceptance criteria in this order: (a) issue description, "
        "(b) CPO comments on the issue, (c) parent issue. "
        "If no acceptance criteria exist, post a comment asking PM to provide them "
        "and set status=blocked — do not guess.\n"
        "3. Verify each criterion is met by the Builder's evidence. "
        "Update to in_review (pass) or blocked (fail — include exact reproduction steps)\n"
        "4. Post a final comment with your Status/Evidence/Risks/Next action/Escalation output\n\n"
        "Act. Do not just describe what you would do."
    ),
    "releaseops": (
        "You are performing a Release/Ops heartbeat inside Paperclip.\n\n"
        "Use the available tools to:\n"
        "1. Read the QA-approved issue and ALL comments — confirm QA issued a pass verdict\n"
        "2. Post a rollout comment using this exact format:\n"
        "   - Deployment steps (ordered list)\n"
        "   - Rollback steps (ordered list)\n"
        "   - Environment prerequisites\n"
        "   - Release risk: LOW / MEDIUM / HIGH\n"
        "   - Readiness gates: typecheck / tests / build / audit / CSO review / DB migrations / rollback path\n"
        "3. Update issue to done when all gates pass and rollout+rollback notes are posted;\n"
        "   update to blocked (with specific reason and owner) if any gate is unresolved\n"
        "4. Post a final comment with your Status/Evidence/Risks/Next action/Escalation output\n\n"
        "Act. Do not just describe what you would do."
    ),
}

_ROLE_KEYWORDS = [
    ("ceo", ["you are the ceo"]),
    ("cto", ["you are the cto"]),
    ("cpo", ["you are the cpo"]),
    ("cso", ["you are the cso"]),
    ("pm", ["you are the pm"]),
    ("builder", ["you are the builder engineer"]),
    ("qa", ["you are the qa engineer"]),
    ("releaseops", ["you are release/ops"]),
]


def detect_role(system_prompt: str) -> str:
    lower = system_prompt.lower()
    for role_key, keywords in _ROLE_KEYWORDS:
        for kw in keywords:
            if kw in lower:
                return role_key
    return "general"


def build_user_prompt(issue, system_prompt: str = "") -> str:
    identifier = issue.get("identifier", issue.get("id", ""))
    title = issue.get("title", "")
    description = issue.get("description", "") or ""

    role = detect_role(system_prompt)
    framing = ROLE_FRAMING.get(
        role,
        (
            "You are a Paperclip agent. Use the available tools to read this issue, "
            "take the appropriate action, and post a final structured comment.\n\n"
            "Act. Do not just describe what you would do."
        ),
    )

    return (
        f"{framing}\n\n"
        f"Your assigned issue:\n"
        f"  ID: {issue.get('id', '')}\n"
        f"  Identifier: {identifier}\n"
        f"  Title: {title}\n"
        f"  Status: {issue.get('status', '')}\n"
        f"  Priority: {issue.get('priority', '')}\n"
        f"  Description:\n{description}"
    )


# ─── Skill injection ──────────────────────────────────────────────────────────


def fetch_skill(skill_name: str, api_url: str, api_key: str, run_id: str) -> str:
    try:
        url = api_url.rstrip("/") + f"/api/skills/{urllib.parse.quote(skill_name)}"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "text/plain, application/json",
        }
        if run_id:
            headers["X-Paperclip-Run-Id"] = run_id
        req = urllib.request.Request(url, method="GET", headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode("utf-8").strip()
            log(f"Loaded skill: {skill_name} ({len(content)} chars)")
            return content
    except Exception as exc:
        log(f"Warning: could not load skill '{skill_name}': {exc}")
        return ""


def build_system_prompt_with_skills(
    base_prompt: str, api_url: str, api_key: str, run_id: str
) -> str:
    skill_names_env = os.getenv("PAPERCLIP_REQUIRED_SKILLS", "").strip()
    if not skill_names_env:
        return base_prompt

    skill_names = [s.strip() for s in skill_names_env.split(",") if s.strip()]
    if not skill_names:
        return base_prompt

    skill_sections = []
    for name in skill_names:
        content = fetch_skill(name, api_url, api_key, run_id)
        if content:
            skill_sections.append(f"---\n# Skill: {name}\n\n{content}\n---")

    if not skill_sections:
        return base_prompt

    return "\n\n".join(skill_sections) + "\n\n" + base_prompt


# ─── Main ─────────────────────────────────────────────────────────────────────


def main():
    api_url = env_required("PAPERCLIP_API_URL")
    api_key = env_required("PAPERCLIP_API_KEY")
    company_id = env_required("PAPERCLIP_COMPANY_ID")
    agent_id = env_required("PAPERCLIP_AGENT_ID")
    run_id = os.getenv("PAPERCLIP_RUN_ID", "").strip()
    task_id = os.getenv("PAPERCLIP_TASK_ID", "").strip()
    model_provider = os.getenv("MODEL_PROVIDER", "unknown").strip()
    model_name = os.getenv("MODEL_NAME", "unknown").strip()
    agent_name = os.getenv("PAPERCLIP_AGENT_NAME", agent_id)
    enable_tool_use = os.getenv("ENABLE_TOOL_USE", "true").strip().lower() not in {
        "0",
        "false",
        "no",
    }
    auto_close = os.getenv("AUTO_CLOSE_ISSUE", "false").strip().lower() in {
        "1",
        "true",
        "yes",
    }

    # Build system prompt (with skills prepended)
    base_prompt = os.getenv(
        "AGENT_SYSTEM_PROMPT",
        "You are a high-quality Paperclip agent. Be precise, safe, and concise.",
    ).strip()
    system_prompt = build_system_prompt_with_skills(
        base_prompt, api_url, api_key, run_id
    )

    # Build tools
    tools = build_tools(company_id, agent_id)

    if enable_tool_use:
        log(
            f"Tool use enabled ({len(tools)} tools, max {os.getenv('MAX_TOOL_TURNS', str(MAX_TOOL_TURNS_DEFAULT))} turns)"
        )
    else:
        log("Tool use disabled (ENABLE_TOOL_USE=false)")

    try:
        # Resolve the issue to work on
        if task_id:
            issue = paperclip_request(
                "GET", f"/api/issues/{task_id}", api_url, api_key, run_id
            )
        else:
            query = urllib.parse.urlencode(
                {
                    "assigneeAgentId": agent_id,
                    "status": "todo,in_progress,blocked",
                }
            )
            issues = paperclip_request(
                "GET",
                f"/api/companies/{company_id}/issues?{query}",
                api_url,
                api_key,
                run_id,
            )
            issue = choose_issue(issues or [])

        if not issue:
            log("No assigned issue found; exiting cleanly.")
            return

        issue_id = issue["id"]
        identifier = issue.get("identifier", issue_id)
        log(f"Processing issue {identifier} (tool_use={enable_tool_use})")

        # Checkout the issue
        checkout_issue(issue_id, agent_id, api_url, api_key, run_id)

        # Build user prompt and run agent loop
        user_prompt = build_user_prompt(issue, system_prompt)

        output, total_in, total_out, total_cached = run_agent_loop(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            tools=tools,
            api_url=api_url,
            api_key=api_key,
            run_id=run_id,
            company_id=company_id,
            agent_id=agent_id,
            enable_tool_use=enable_tool_use,
        )

        # Report cumulative token usage
        report_cost_event(
            api_url=api_url,
            api_key=api_key,
            run_id=run_id,
            company_id=company_id,
            agent_id=agent_id,
            provider=model_provider,
            model=model_name,
            input_tokens=total_in,
            output_tokens=total_out,
            cached_tokens=total_cached,
        )

        # Post final comment (only if there is text output — tool calls may have
        # already posted comments directly via paperclip_add_comment)
        if output and output.strip():
            comment_body = f"## {agent_name} ({model_name})\n\n{output}\n"
            if total_in or total_out:
                comment_body += (
                    f"\n---\n*Tokens: {total_in} in / {total_out} out"
                    + (f" / {total_cached} cached" if total_cached else "")
                    + "*\n"
                )
            paperclip_request(
                "POST",
                f"/api/issues/{issue_id}/comments",
                api_url,
                api_key,
                run_id,
                {"body": comment_body},
            )

        if auto_close:
            paperclip_request(
                "PATCH",
                f"/api/issues/{issue_id}",
                api_url,
                api_key,
                run_id,
                {"status": "done"},
            )

        log(f"Issue {identifier} processed successfully")

    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="ignore")
        log(f"HTTPError: {exc.code} {err_body}")
        raise
    except Exception as exc:
        log(f"Error: {exc}")
        raise


if __name__ == "__main__":
    main()
