"""LangGraph workflow graph — WF2: Scrum Master + Code Operator + Test Lead + Infra Lead.

Deterministic retry/escalation policy enforced at graph level.
Intelligence lives in nodes; correctness guarantees live here.

Spec ref: AgenticSquad_Functional_Spec v2.8 RC §7, Phase 2 ACTION_SPEC — Track D
WF2 ref: ACTION_SPEC_WF2 — Infra Lead + VPS Deploy Verification
"""

import logging
from dataclasses import replace

from langgraph.graph import StateGraph, END

from .risk import classify_pr_risk
from .state import SDLCState
from .nodes.architect import architect_node
from .nodes.infra_lead import infra_lead_node
from .nodes.po import po_node
from .nodes.scrum_master import scrum_master_node
from .nodes.code_operator import code_operator_node
from .nodes.test_lead import test_lead_node

logger = logging.getLogger(__name__)


def route_after_scrum_master(state: SDLCState) -> str:
    """Conditional edge: what does the Scrum Master do next?"""
    stage = state.workflow_stage

    if stage == "dispatch_coding":
        return "code_operator"
    elif stage == "dispatch_architect":
        return "architect"
    elif stage == "dispatch_testing":
        return "test_lead"
    elif stage == "dispatch_planning":
        return "po"
    elif stage == "dispatch_infra_query":
        return "infra_lead"
    elif stage == "awaiting_merge_approval":
        # When human approves merge, route back to Scrum Master to execute it.
        # Without a decision, interrupt and wait for human input.
        if state.human_decision == "merge":
            return "scrum_master"
        return "__interrupt__"
    elif stage == "merged":
        return "infra_lead"
    elif stage in ("done", "budget_paused", "escalated", "idle"):
        return END
    else:
        return END


def route_after_code_operator(state: SDLCState) -> str:
    """After Code Operator: PR created → retry_gate. Failure → retry_gate."""
    # All Code Operator outcomes pass through the retry gate for deterministic
    # retry_count tracking and escalation enforcement.
    return "retry_gate"


def route_after_test_lead(state: SDLCState) -> str:
    """After Test Lead: all outcomes pass through retry gate."""
    return "retry_gate"


def route_after_architect(state: SDLCState) -> str:
    """After Architect: outcomes pass through retry gate."""
    return "retry_gate"


async def retry_gate_node(state: SDLCState) -> SDLCState:
    """Deterministic retry/escalation policy — enforced outside the LLM.

    This node guarantees:
    1. retry_count is incremented on every failure (coding_failed or test fail).
    2. Escalation occurs deterministically when retry_count >= max_retries.
    3. Successful PR creation routes to test_lead (or scrum_master if tests pass).
    4. No LLM involvement — pure state machine logic.
    """
    stage = state.workflow_stage

    # ── Normalize risk tier from changed files ──
    # Always derive from changed files when available, because state defaults
    # to "normal" and should not mask true high-risk/protected paths.
    if state.pr_changed_files:
        risk_tier = classify_pr_risk(state.pr_changed_files)
    elif state.pr_risk_tier in {"normal", "high_risk", "protected"}:
        risk_tier = state.pr_risk_tier
    else:
        risk_tier = "normal"

    # ── Happy path: PR created, route through Architect/Test Lead ──
    if stage == "pr_created" and state.pr_number:
        if risk_tier == "high_risk" and state.architect_review_passed is None:
            logger.info(
                f"PR #{state.pr_number} classified high_risk — dispatching to Architect"
            )
            return replace(
                state,
                workflow_stage="dispatch_architect",
                pr_risk_tier=risk_tier,
            )
        logger.info(
            f"PR #{state.pr_number} classified {risk_tier} — dispatching to Test Lead"
        )
        return replace(
            state,
            workflow_stage="dispatch_testing",
            pr_risk_tier=risk_tier,
        )

    # ── Architect approved: proceed to Test Lead ──
    if stage == "architect_passed" and state.pr_number:
        logger.info(
            f"Architect approved PR #{state.pr_number} — dispatching to Test Lead"
        )
        return replace(
            state,
            workflow_stage="dispatch_testing",
            pr_risk_tier=risk_tier,
        )

    # ── Test Lead completed with PASS ──
    if state.test_passed and state.pr_number:
        if risk_tier == "protected":
            logger.info(
                f"PR #{state.pr_number} touches protected paths — awaiting human merge approval"
            )
            return replace(
                state,
                workflow_stage="awaiting_merge_approval",
                pr_risk_tier=risk_tier,
                human_decision="",
            )

        logger.info(
            f"Test Lead approved PR #{state.pr_number} ({risk_tier}) — enabling autonomous merge"
        )
        # Normal/high-risk PRs bypass the manual merge pause.
        return replace(
            state,
            workflow_stage="awaiting_merge_approval",
            pr_risk_tier=risk_tier,
            human_decision="merge",
        )

    # ── Failure path: increment retry_count, check escalation ──
    new_retry_count = state.retry_count + 1
    failure_reason = (
        state.test_failure_report
        or state.error_context.get("error_message", "Unknown failure")
    )

    if new_retry_count >= state.max_retries:
        logger.warning(
            f"Story #{state.current_issue_number} escalated after "
            f"{new_retry_count} failures. Last error: {failure_reason[:100]}"
        )
        return replace(
            state,
            workflow_stage="escalated",
            retry_count=new_retry_count,
        )

    # ── Retry: reset test state and re-dispatch to Code Operator ──
    logger.info(
        f"Retry {new_retry_count}/{state.max_retries} for "
        f"issue #{state.current_issue_number}"
    )
    return replace(
        state,
        workflow_stage="dispatch_coding",
        retry_count=new_retry_count,
        # Reset test state for fresh attempt
        test_passed=False,
        test_workflow_run_id=None,
        test_workflow_run_ids=[],
        ac_compliance={},
        architect_review_passed=None,
        architect_review_report="",
        human_decision="",
    )


def route_after_retry_gate(state: SDLCState) -> str:
    """Route based on retry gate decision."""
    stage = state.workflow_stage

    if stage == "dispatch_testing":
        return "test_lead"
    elif stage == "dispatch_architect":
        return "architect"
    elif stage == "dispatch_coding":
        return "code_operator"
    elif stage == "awaiting_merge_approval":
        if state.human_decision == "merge":
            return "scrum_master"
        return "__interrupt__"
    elif stage == "escalated":
        return "scrum_master"  # Scrum Master notifies human
    else:
        return END


def route_after_infra_lead(state: SDLCState) -> str:
    """Route based on Infra Lead outcome.

    - infra_query_complete → scrum_master (ad-hoc query result relay)
    - deployed/deploy_failed with deploy flow → scrum_master
    - awaiting_production_approval → interrupt for human approval
    """
    stage = state.workflow_stage

    if stage == "infra_query_complete":
        # Ad-hoc query — return to SM to relay answer to Slack
        return "scrum_master"
    elif stage == "awaiting_production_approval":
        if state.human_decision == "approve_production":
            return "infra_lead"  # Resume deploy after human approval
        return "__interrupt__"
    elif stage in ("deployed", "deploy_failed"):
        return "scrum_master"
    else:
        return END


def route_after_po(state: SDLCState) -> str:
    """After PO: return to Scrum Master or end."""
    stage = state.workflow_stage
    if stage in ("idle", "done"):
        return END
    return "scrum_master"


def build_graph(checkpointer=None) -> StateGraph:
    """Build the Phase 2 + WF3 workflow graph."""
    graph = StateGraph(SDLCState)

    # Nodes
    graph.add_node("scrum_master", scrum_master_node)
    graph.add_node("po", po_node)
    graph.add_node("code_operator", code_operator_node)
    graph.add_node("architect", architect_node)
    graph.add_node("test_lead", test_lead_node)
    graph.add_node("retry_gate", retry_gate_node)
    graph.add_node("infra_lead", infra_lead_node)

    # Edges
    graph.set_entry_point("scrum_master")
    graph.add_conditional_edges("scrum_master", route_after_scrum_master)
    graph.add_conditional_edges("po", route_after_po)
    graph.add_conditional_edges("code_operator", route_after_code_operator)
    graph.add_conditional_edges("architect", route_after_architect)
    graph.add_conditional_edges("test_lead", route_after_test_lead)
    graph.add_conditional_edges("retry_gate", route_after_retry_gate)
    graph.add_conditional_edges("infra_lead", route_after_infra_lead)

    return graph.compile(checkpointer=checkpointer)
