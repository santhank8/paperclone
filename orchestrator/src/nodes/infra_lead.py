"""Infra Lead node — LLM-backed deployment orchestration and health verification.

Uses ChatAnthropic (langchain-anthropic) for LLM calls, ensuring LangSmith
auto-tracing. Follows the §8 implementation mandate: agentic loop with tools.

Receives merged PRs from the Scrum Master, triggers the appropriate VPS deploy
workflow, verifies service health post-deploy, and produces evidence for Linear.

Spec ref: ACTION_SPEC_WF2 §A–E, ACTION_SPEC_WF5 §B
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import replace
from typing import Optional

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
from ..tools.vps_mcp_client import VpsMcpClient

logger = logging.getLogger(__name__)

# ── Service detection from changed files (TRA-21) ──

WORKFORCE_PREFIX = "agent-workforce/"
SERVICES_PREFIX = "services/"
FRONTEND_PREFIX = "frontend/"

# Map from workflow file to the deploy paths it covers
DEPLOY_WORKFLOWS: dict[str, list[str]] = {
    "vps-deploy-workforce.yml": [WORKFORCE_PREFIX],
    "vps-deploy-app.yml": [SERVICES_PREFIX],
}


# ── System prompt ──

DEPLOY_SYSTEM_PROMPT = """You are the Infra Lead for the Trading Agent Platform's agentic workforce.

## Your Role
You manage deployment verification after code is merged. You trigger deploy
workflows, verify health via the VPS MCP Server, and decide whether the
deployment succeeded or needs rollback.

## Current Context
- PR: #{pr_number} merged to main
- Environment: {deploy_environment}
- Changed files: {pr_changed_files}

## Workflow
1. Detect which services are affected by the merged PR
2. Select the appropriate deploy workflow(s)
3. If production: STOP and report that human approval is needed (GitHub Environment gate)
4. Trigger deploy workflow(s) and wait for completion
5. Verify health via MCP: check container status, recent logs, system stats
6. If healthy: build evidence, report success
7. If unhealthy: trigger rollback, report failure

## Rules
- Dev/staging: fully autonomous. No human approval needed.
- Production: ALWAYS pause for human approval. This is the one hard gate.
- If health checks fail after deploy, trigger rollback immediately.
- Post deployment evidence to Slack and Linear.
- You act AUTONOMOUSLY in dev/staging. Do not wait for human confirmation.
"""

AD_HOC_SYSTEM_PROMPT = """You are the Infra Lead for the Trading Agent Platform's agentic workforce.

## Your Role
You answer ad-hoc infrastructure queries from the Scrum Master. You have full
VPS MCP access to inspect containers, check health endpoints, read logs, and
query system stats.

## Current Query
{infra_query}

## Workflow
1. Read the question in infra_query
2. Use the appropriate tools: list_containers, check_service_health,
   get_system_stats, get_container_logs, etc.
3. Compile a structured findings report
4. Set workflow_stage to "infra_query_complete"
5. Do NOT trigger any deployments or rollbacks

## Ad-Hoc Query Response Rules
- Your audience is the Scrum Master, not a human. Write findings as
  structured data: what you checked, what succeeded, what failed
  (with exact error messages and status codes), and what the likely fix is.
- Do NOT recommend "contacting" anyone. There is no DevOps team. The human
  IS the operator.
- Do NOT give organizational advice ("escalate to the appropriate team").
  Give technical specifics ("VPS_MCP_TOKEN in the workforce container
  needs to match the value configured in the MCP server's .env file on
  app-01 at /opt/trading-agent/deploy/vps/.env.app").
- If a tool call fails, report the exact error. Do not wrap it in
  vague language. "MCP returned HTTP 401 Unauthorized" is better than
  "experiencing authentication issues."
- If all monitoring tools fail, report what you know: which tools you
  tried, what errors each returned, and what the human can do via SSH
  as a fallback (with specific commands).
"""

# Keep backward compat alias
SYSTEM_PROMPT = DEPLOY_SYSTEM_PROMPT

# ── LangChain tool schemas ──

TOOLS = [
    {
        "name": "detect_affected_services",
        "description": (
            "Analyze PR changed files and return list of affected services. "
            "Returns JSON array of service names."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "changed_files": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of file paths changed in the PR",
                },
            },
            "required": ["changed_files"],
        },
    },
    {
        "name": "select_deploy_workflows",
        "description": (
            "Map affected services to GitHub Actions deploy workflows. "
            "Returns JSON array of workflow filenames to trigger."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "changed_files": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of file paths changed in the PR",
                },
            },
            "required": ["changed_files"],
        },
    },
    {
        "name": "trigger_deploy_workflow",
        "description": (
            "Dispatch a GitHub Actions deploy workflow. Returns run ID on success."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "workflow_file": {
                    "type": "string",
                    "description": "The workflow filename (e.g. 'vps-deploy-app.yml')",
                },
                "inputs": {
                    "type": "object",
                    "description": "Inputs to pass to the workflow dispatch",
                },
            },
            "required": ["workflow_file"],
        },
    },
    {
        "name": "check_workflow_status",
        "description": (
            "Poll a GitHub Actions workflow run until completion. "
            "Returns status and conclusion."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "run_id": {
                    "type": "integer",
                    "description": "The GitHub Actions run ID to check",
                },
            },
            "required": ["run_id"],
        },
    },
    {
        "name": "verify_health_via_mcp",
        "description": (
            "Call VPS MCP Server to inspect container health, logs, and system stats. "
            "Returns structured health evidence."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "affected_services": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Services to verify health for",
                },
            },
            "required": ["affected_services"],
        },
    },
    {
        "name": "build_deploy_evidence",
        "description": (
            "Compile health check results into structured evidence dict for Linear."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "affected_services": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "deploy_results": {
                    "type": "array",
                    "description": "Array of deploy result objects with run_id, conclusion, etc.",
                },
                "mcp_evidence": {
                    "type": "object",
                    "description": "MCP health verification evidence",
                },
                "environment": {
                    "type": "string",
                },
            },
            "required": ["affected_services", "deploy_results", "mcp_evidence", "environment"],
        },
    },
    {
        "name": "trigger_rollback",
        "description": (
            "Trigger rollback workflow if health verification fails after deploy."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "workflow_file": {
                    "type": "string",
                    "description": "The deploy workflow to rollback",
                },
                "reason": {
                    "type": "string",
                    "description": "Reason for rollback",
                },
            },
            "required": ["workflow_file", "reason"],
        },
    },
]


# ── Tool implementations ──


def detect_affected_services(changed_files: list[str]) -> list[str]:
    """Derive affected service names from PR changed files.

    Returns a list of individual service directory names (e.g. 'pnl-service')
    for app services, or ['agent-workforce'] for workforce changes, or
    ['frontend'] for frontend changes.
    """
    affected: set[str] = set()
    for path in changed_files:
        if path.startswith(WORKFORCE_PREFIX):
            affected.add("agent-workforce")
        elif path.startswith(SERVICES_PREFIX):
            # Extract service name: services/<name>/...
            parts = path.split("/")
            if len(parts) >= 2:
                affected.add(parts[1])
        elif path.startswith(FRONTEND_PREFIX):
            affected.add("frontend")
    return sorted(affected)


def select_deploy_workflows(changed_files: list[str]) -> list[str]:
    """Select which VPS deploy workflows to trigger based on changed files.

    Rules:
    - agent-workforce/** → vps-deploy-workforce.yml
    - services/** → vps-deploy-app.yml
    - frontend/** → vps-deploy-app.yml (frontend is deployed with app services)
    - Mixed → both workflows
    """
    has_workforce = any(
        p.startswith(WORKFORCE_PREFIX) for p in changed_files
    )
    has_app = any(
        p.startswith(SERVICES_PREFIX) or p.startswith(FRONTEND_PREFIX)
        for p in changed_files
    )

    workflows: list[str] = []
    if has_workforce:
        workflows.append("vps-deploy-workforce.yml")
    if has_app:
        workflows.append("vps-deploy-app.yml")
    return workflows


async def _trigger_and_poll_deploy(
    gh: GitHubClient,
    workflow_file: str,
    inputs: dict,
    poll_interval: int = 30,
    max_wait: int = 600,
) -> dict:
    """Trigger a deploy workflow and poll until completion.

    Returns:
        {"run_id": int, "status": str, "conclusion": str, "html_url": str}
    """
    logger.info(f"Triggering deploy workflow: {workflow_file}")
    run_id = gh.trigger_workflow(workflow_file, inputs)
    logger.info(f"Deploy workflow triggered: {workflow_file} → run_id={run_id}")

    elapsed = 0
    while elapsed < max_wait:
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval
        run_info = gh.get_workflow_run(run_id)
        status = run_info["status"]
        logger.info(
            f"Deploy {workflow_file} run {run_id}: status={status}, "
            f"conclusion={run_info.get('conclusion')}"
        )
        if status == "completed":
            return {
                "run_id": run_id,
                "status": status,
                "conclusion": run_info.get("conclusion", "unknown"),
                "html_url": run_info.get("html_url", ""),
            }

    # Timeout
    return {
        "run_id": run_id,
        "status": "timed_out",
        "conclusion": "timed_out",
        "html_url": "",
    }


def _verify_health_via_mcp(
    affected_services: list[str],
) -> dict:
    """Verify service health via VPS MCP tooling.

    Returns structured evidence dict.
    """
    evidence: dict = {
        "mcp_available": False,
        "containers": {},
        "health_check": None,
        "errors": [],
    }

    try:
        client = VpsMcpClient()
        client.initialize()
        evidence["mcp_available"] = True

        # Overall health check
        health = client.check_service_health()
        evidence["health_check"] = _extract_mcp_result(health)

        # Check containers for affected services
        containers_result = client.list_containers()
        all_containers = _extract_mcp_result(containers_result)
        evidence["containers"]["all"] = all_containers

        # Get logs for affected service containers
        for svc in affected_services:
            try:
                logs = client.get_container_logs(svc, tail=20)
                evidence["containers"][svc] = {
                    "logs": _extract_mcp_result(logs),
                }
            except Exception as e:
                evidence["containers"][svc] = {"error": str(e)}

    except Exception as e:
        evidence["errors"].append(f"MCP verification failed: {e}")
        logger.warning(f"VPS MCP verification failed: {e}")

    return evidence


def _extract_mcp_result(response: dict) -> Optional[str]:
    """Extract the text content from an MCP tool call response."""
    if not response:
        return None
    result = response.get("result", {})
    content = result.get("content", [])
    if content and isinstance(content, list):
        texts = [c.get("text", "") for c in content if c.get("type") == "text"]
        return "\n".join(texts) if texts else str(content)
    return str(result) if result else None


def _build_deploy_evidence(
    affected_services: list[str],
    deploy_results: list[dict],
    mcp_evidence: dict,
    environment: str,
) -> dict:
    """Build structured deploy evidence for Linear comment."""
    all_succeeded = all(
        r.get("conclusion") == "success" for r in deploy_results
    )
    return {
        "environment": environment,
        "affected_services": affected_services,
        "deploy_results": deploy_results,
        "all_deploys_succeeded": all_succeeded,
        "mcp_verification": mcp_evidence,
        "health_verified": all_succeeded and mcp_evidence.get("mcp_available", False),
    }


def _format_evidence_for_linear(evidence: dict) -> str:
    """Format deploy evidence as a markdown comment for Linear."""
    env = evidence.get("environment", "unknown")
    services = ", ".join(evidence.get("affected_services", []))
    status = "PASSED" if evidence.get("health_verified") else "NEEDS ATTENTION"

    lines = [
        f"## Deploy Verification — {env}",
        f"**Status:** {status}",
        f"**Services:** {services}",
        "",
        "### Deploy Results",
    ]

    for r in evidence.get("deploy_results", []):
        conclusion = r.get("conclusion", "unknown")
        emoji = "OK" if conclusion == "success" else "FAIL"
        url = r.get("html_url", "")
        lines.append(
            f"- [{emoji}] Run {r.get('run_id', '?')}: {conclusion}"
            + (f" — [view]({url})" if url else "")
        )

    mcp = evidence.get("mcp_verification", {})
    if mcp.get("mcp_available"):
        lines.extend(["", "### VPS MCP Health Check"])
        health = mcp.get("health_check")
        if health:
            lines.append(f"```\n{health[:500]}\n```")
        if mcp.get("errors"):
            lines.append(f"**Errors:** {', '.join(mcp['errors'])}")
    else:
        lines.extend(["", "_VPS MCP not available — skipped container verification._"])

    return "\n".join(lines)


# ── Production release gate (TRA-24) ──


def _build_release_summary(state: SDLCState, affected_services: list[str]) -> str:
    """Produce a release summary for production gate pause."""
    lines = [
        "## Production Release Summary",
        "",
        f"**Issue:** #{state.current_issue_number}",
        f"**PR:** #{state.pr_number}",
        f"**Services:** {', '.join(affected_services)}",
        f"**Risk tier:** {state.pr_risk_tier}",
        "",
        "### Pre-release Checklist",
        f"- Tests: {'PASSED' if state.test_passed else 'NOT RUN'}",
        f"- Architect review: {_format_architect_status(state)}",
        f"- Dev deploy: {state.deploy_status}",
        "",
        "**Action required:** Approve the GitHub Environment protection rule ",
        "for `production` to proceed with production deployment.",
    ]
    return "\n".join(lines)


def _format_architect_status(state: SDLCState) -> str:
    if state.architect_review_passed is True:
        return "APPROVED"
    elif state.architect_review_passed is False:
        return "REJECTED"
    return "N/A"


# ── Tool executor ──


async def _execute_tool(
    tool_name: str,
    tool_input: dict,
    gh: GitHubClient,
    state: SDLCState,
) -> tuple[str, dict]:
    """Execute a single Infra Lead tool call. Returns (result_text, state_updates)."""
    state_updates: dict = {}

    if tool_name == "detect_affected_services":
        changed_files = tool_input.get("changed_files", [])
        services = detect_affected_services(changed_files)
        return json.dumps({"affected_services": services}), state_updates

    if tool_name == "select_deploy_workflows":
        changed_files = tool_input.get("changed_files", [])
        workflows = select_deploy_workflows(changed_files)
        return json.dumps({"workflows": workflows}), state_updates

    if tool_name == "trigger_deploy_workflow":
        workflow_file = tool_input["workflow_file"]
        inputs = tool_input.get("inputs", {})
        try:
            result = await _trigger_and_poll_deploy(gh, workflow_file, inputs)
            state_updates["deploy_workflow_run_id"] = result.get("run_id")
            return json.dumps(result), state_updates
        except Exception as e:
            return json.dumps({
                "workflow": workflow_file,
                "status": "error",
                "conclusion": "error",
                "error": str(e),
            }), state_updates

    if tool_name == "check_workflow_status":
        run_id = tool_input["run_id"]
        try:
            run_info = gh.get_workflow_run(run_id)
            return json.dumps({
                "run_id": run_id,
                "status": run_info.get("status", "unknown"),
                "conclusion": run_info.get("conclusion"),
                "html_url": run_info.get("html_url", ""),
            }), state_updates
        except Exception as e:
            return json.dumps({"error": str(e)}), state_updates

    if tool_name == "verify_health_via_mcp":
        affected_services = tool_input.get("affected_services", [])
        evidence = _verify_health_via_mcp(affected_services)
        return json.dumps(evidence, default=str), state_updates

    if tool_name == "build_deploy_evidence":
        affected_services = tool_input.get("affected_services", [])
        deploy_results = tool_input.get("deploy_results", [])
        mcp_evidence = tool_input.get("mcp_evidence", {})
        environment = tool_input.get("environment", state.deploy_environment)
        evidence = _build_deploy_evidence(
            affected_services, deploy_results, mcp_evidence, environment
        )
        health_verified = evidence.get("health_verified", False)
        all_deploys_ok = evidence.get("all_deploys_succeeded", False)

        if all_deploys_ok and health_verified:
            state_updates["deploy_status"] = "succeeded"
            state_updates["workflow_stage"] = "deployed"
        elif all_deploys_ok:
            state_updates["deploy_status"] = "succeeded"
            state_updates["workflow_stage"] = "deployed"
        else:
            state_updates["deploy_status"] = "failed"
            state_updates["workflow_stage"] = "deploy_failed"

        state_updates["health_verified"] = health_verified
        state_updates["deploy_evidence"] = evidence
        return json.dumps(evidence, default=str), state_updates

    if tool_name == "trigger_rollback":
        workflow_file = tool_input.get("workflow_file", "")
        reason = tool_input.get("reason", "Health check failure")
        try:
            rollback_wf = workflow_file.replace("deploy", "rollback") if workflow_file else "vps-rollback.yml"
            run_id = gh.trigger_workflow(rollback_wf, {"reason": reason})
            state_updates["deploy_status"] = "rolled_back"
            state_updates["workflow_stage"] = "deploy_failed"
            return json.dumps({
                "rollback_triggered": True,
                "rollback_workflow": rollback_wf,
                "run_id": run_id,
                "reason": reason,
            }), state_updates
        except Exception as e:
            return json.dumps({
                "rollback_triggered": False,
                "error": str(e),
            }), state_updates

    return f"Unknown tool: {tool_name}", state_updates


# ── Main node function ──


async def _run_ad_hoc_query(state: SDLCState) -> SDLCState:
    """Handle ad-hoc infrastructure queries dispatched by the Scrum Master.

    Mode 2: Investigate and report — no deployments or rollbacks.
    """
    logger.info(f"Infra Lead ad-hoc query: {state.infra_query}")

    system_prompt = AD_HOC_SYSTEM_PROMPT.format(
        infra_query=state.infra_query,
    )

    state_messages = state.messages.copy() if state.messages else []
    state_messages = await manage_message_history(state_messages)

    lc_messages: list = [SystemMessage(content=system_prompt)]
    lc_messages.extend(dicts_to_langchain(state_messages))
    lc_messages.append(
        HumanMessage(content=f"Please investigate: {state.infra_query}")
    )

    # Ad-hoc queries only need health/inspection tools — not deploy tools
    ad_hoc_tools = [t for t in TOOLS if t["name"] in (
        "verify_health_via_mcp", "detect_affected_services",
    )]

    max_iterations = 10
    cost_config = state.project_config.get("cost_control", {})
    cost_callback = CostTrackingCallback("infra_lead", cost_config)
    llm = create_llm(callbacks=[cost_callback])
    llm_with_tools = llm.bind_tools(ad_hoc_tools)
    cost_tracker = state.cost_tracker.copy() if state.cost_tracker else {}

    # No GitHub client needed for ad-hoc queries, but _execute_tool expects one
    gh = GitHubClient.from_state(state)

    for _ in range(max_iterations):
        response: AIMessage = await llm_with_tools.ainvoke(lc_messages)
        lc_messages.append(response)

        if not response.tool_calls:
            break

        for tc in response.tool_calls:
            try:
                result, _updates = await _execute_tool(
                    tc["name"], tc["args"], gh, state
                )
            except Exception as e:
                logger.error(f"Tool {tc['name']} failed: {e}")
                result = f"Error: {str(e)}"

            lc_messages.append(
                ToolMessage(content=result, tool_call_id=tc["id"])
            )

    for entry in cost_callback.entries:
        cost_tracker = accumulate_cost(cost_tracker, entry)

    output_messages = langchain_to_dicts(
        [m for m in lc_messages if not isinstance(m, SystemMessage)]
    )

    logger.info("Infra Lead ad-hoc query complete")

    return replace(
        state,
        messages=output_messages,
        cost_tracker=cost_tracker,
        workflow_stage="infra_query_complete",
    )


async def infra_lead_node(state: SDLCState) -> SDLCState:
    """LLM-backed Infra Lead node — agentic deploy + verify + gate + ad-hoc queries.

    Uses ChatAnthropic with tool-use for deployment orchestration.
    Follows §8 implementation mandate: agentic loop with max 10 iterations.

    Mode 1: Post-merge deployment (default)
    Mode 2: Ad-hoc infrastructure query (when infra_query is set)
    """
    # Mode 2: Ad-hoc infrastructure query (TRA-91)
    if state.workflow_stage == "dispatch_infra_query" and state.infra_query:
        return await _run_ad_hoc_query(state)

    # Mode 1: Post-merge deployment
    logger.info(
        f"Infra Lead activated — PR #{state.pr_number}, "
        f"env={state.deploy_environment}"
    )

    changed_files = state.pr_changed_files or []

    # Quick exit: no deployable changes
    detected_services = detect_affected_services(changed_files)
    workflows = select_deploy_workflows(changed_files)
    if not workflows:
        logger.info("No deployable changes detected — skipping deploy")
        return replace(
            state,
            deploy_status="skipped",
            health_verified=True,
            workflow_stage="deployed",
            deploy_evidence={
                "environment": state.deploy_environment,
                "affected_services": [],
                "skipped": True,
                "reason": "No deployable service changes detected",
            },
        )

    # Production gate: HITL pause (no LLM needed for this decision)
    if state.deploy_environment == "production":
        logger.info(
            "Production deploy detected — pausing for human approval"
        )
        release_summary = _build_release_summary(state, detected_services)
        return replace(
            state,
            workflow_stage="awaiting_production_approval",
            deploy_status="pending",
            deploy_evidence={
                "release_summary": release_summary,
                "affected_services": detected_services,
            },
        )

    # ── LLM-backed agentic loop for dev/staging deploys ──
    gh = GitHubClient.from_state(state)

    system_prompt = DEPLOY_SYSTEM_PROMPT.format(
        pr_number=state.pr_number or "?",
        deploy_environment=state.deploy_environment,
        pr_changed_files=", ".join(changed_files[:20]),
    )

    state_messages = state.messages.copy() if state.messages else []
    state_messages = await manage_message_history(state_messages)

    lc_messages: list = [SystemMessage(content=system_prompt)]
    lc_messages.extend(dicts_to_langchain(state_messages))
    lc_messages.append(
        HumanMessage(
            content=(
                f"PR #{state.pr_number} has been merged to main. "
                f"Changed files: {json.dumps(changed_files[:20])}. "
                f"Environment: {state.deploy_environment}. "
                f"Detect affected services, trigger deploys, verify health, "
                f"and build evidence."
            )
        )
    )

    max_iterations = 10
    accumulated_state_updates: dict = {}
    cost_config = state.project_config.get("cost_control", {})
    cost_callback = CostTrackingCallback("infra_lead", cost_config)
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
                    tc["name"], tc["args"], gh, state
                )
                accumulated_state_updates.update(updates)
            except Exception as e:
                logger.error(f"Tool {tc['name']} failed: {e}")
                result = f"Error: {str(e)}"

            lc_messages.append(
                ToolMessage(content=result, tool_call_id=tc["id"])
            )

    # Accumulate cost tracking
    for entry in cost_callback.entries:
        cost_tracker = accumulate_cost(cost_tracker, entry)

    output_messages = langchain_to_dicts(
        [m for m in lc_messages if not isinstance(m, SystemMessage)]
    )

    # Fail-closed: if the LLM didn't produce a deploy outcome, mark as failed
    if "deploy_status" not in accumulated_state_updates:
        accumulated_state_updates["deploy_status"] = "failed"
        accumulated_state_updates["workflow_stage"] = "deploy_failed"
        accumulated_state_updates["deploy_evidence"] = {
            "error": "Infra Lead did not produce deploy outcome within iteration limit",
        }

    logger.info(
        f"Infra Lead complete — status={accumulated_state_updates.get('deploy_status')}, "
        f"health_verified={accumulated_state_updates.get('health_verified', False)}"
    )

    return replace(
        state,
        messages=output_messages,
        cost_tracker=cost_tracker,
        **accumulated_state_updates,
    )
