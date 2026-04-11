"""Test graph routing with retry gate and Test Lead node — Phase 2.

Spec ref: Phase 2 ACTION_SPEC — Track D, Track F
"""

import pytest

from src.graph import (
    route_after_scrum_master,
    route_after_code_operator,
    route_after_architect,
    route_after_test_lead,
    route_after_retry_gate,
    retry_gate_node,
    build_graph,
)
from src.state import SDLCState


class TestRouteAfterScrumMasterPhase2:
    """Phase 2 routing: Scrum Master can dispatch to Test Lead."""

    def test_dispatch_coding_routes_to_code_operator(self) -> None:
        state = SDLCState(workflow_stage="dispatch_coding")
        assert route_after_scrum_master(state) == "code_operator"

    def test_dispatch_testing_routes_to_test_lead(self) -> None:
        """Scrum Master dispatches to Test Lead."""
        state = SDLCState(workflow_stage="dispatch_testing")
        assert route_after_scrum_master(state) == "test_lead"

    def test_dispatch_architect_routes_to_architect(self) -> None:
        state = SDLCState(workflow_stage="dispatch_architect")
        assert route_after_scrum_master(state) == "architect"

    def test_awaiting_merge_routes_to_interrupt(self) -> None:
        state = SDLCState(workflow_stage="awaiting_merge_approval")
        assert route_after_scrum_master(state) == "__interrupt__"

    def test_awaiting_merge_with_decision_routes_to_scrum_master(self) -> None:
        state = SDLCState(
            workflow_stage="awaiting_merge_approval",
            human_decision="merge",
        )
        assert route_after_scrum_master(state) == "scrum_master"

    def test_done_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="done")
        assert route_after_scrum_master(state) == "__end__"

    def test_merged_routes_to_infra_lead(self) -> None:
        """WF2: merged → infra_lead instead of END."""
        state = SDLCState(workflow_stage="merged")
        assert route_after_scrum_master(state) == "infra_lead"

    def test_budget_paused_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="budget_paused")
        assert route_after_scrum_master(state) == "__end__"

    def test_escalated_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="escalated")
        assert route_after_scrum_master(state) == "__end__"

    def test_idle_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="idle")
        assert route_after_scrum_master(state) == "__end__"


class TestRouteAfterCodeOperatorPhase2:
    """Phase 2: Code Operator always routes to retry_gate."""

    def test_pr_created_routes_to_retry_gate(self) -> None:
        state = SDLCState(workflow_stage="pr_created", pr_number=87)
        assert route_after_code_operator(state) == "retry_gate"

    def test_error_routes_to_retry_gate(self) -> None:
        state = SDLCState(
            error_context={"error_type": "job_dispatch_failure"}
        )
        assert route_after_code_operator(state) == "retry_gate"

    def test_no_pr_no_error_routes_to_retry_gate(self) -> None:
        state = SDLCState()
        assert route_after_code_operator(state) == "retry_gate"


class TestRouteAfterTestLead:
    """Test Lead always routes to retry_gate."""

    def test_test_pass_routes_to_retry_gate(self) -> None:
        state = SDLCState(test_passed=True)
        assert route_after_test_lead(state) == "retry_gate"

    def test_test_fail_routes_to_retry_gate(self) -> None:
        state = SDLCState(test_passed=False, retry_count=1)
        assert route_after_test_lead(state) == "retry_gate"


class TestRouteAfterArchitect:
    def test_architect_routes_to_retry_gate(self) -> None:
        state = SDLCState(workflow_stage="architect_passed")
        assert route_after_architect(state) == "retry_gate"


class TestRetryGateNode:
    """Deterministic retry gate behavior tests."""

    @pytest.mark.asyncio
    async def test_pr_created_untested_dispatches_to_testing(self) -> None:
        """PR created but not yet tested → dispatch_testing."""
        state = SDLCState(
            workflow_stage="pr_created",
            pr_number=99,
            test_passed=False,
            pr_changed_files=["services/pnl-service/main.py"],
        )
        result = await retry_gate_node(state)
        assert result.workflow_stage == "dispatch_testing"
        assert result.pr_risk_tier == "normal"

    @pytest.mark.asyncio
    async def test_pr_created_high_risk_dispatches_architect(self) -> None:
        state = SDLCState(
            workflow_stage="pr_created",
            pr_number=99,
            test_passed=False,
            pr_changed_files=["services/agent-runner/auth_handlers.py"],
        )
        result = await retry_gate_node(state)
        assert result.workflow_stage == "dispatch_architect"
        assert result.pr_risk_tier == "high_risk"

    @pytest.mark.asyncio
    async def test_architect_passed_dispatches_testing(self) -> None:
        state = SDLCState(
            workflow_stage="architect_passed",
            pr_number=99,
            architect_review_passed=True,
            pr_changed_files=["services/agent-runner/auth_handlers.py"],
        )
        result = await retry_gate_node(state)
        assert result.workflow_stage == "dispatch_testing"

    @pytest.mark.asyncio
    async def test_test_passed_normal_automerge_sets_merge_decision(self) -> None:
        """Normal/high-risk approvals bypass human merge pause."""
        state = SDLCState(
            workflow_stage="tested",
            pr_number=99,
            test_passed=True,
            pr_changed_files=["services/pnl-service/main.py"],
        )
        result = await retry_gate_node(state)
        assert result.workflow_stage == "awaiting_merge_approval"
        assert result.human_decision == "merge"

    @pytest.mark.asyncio
    async def test_test_passed_protected_keeps_human_gate(self) -> None:
        state = SDLCState(
            workflow_stage="tested",
            pr_number=99,
            test_passed=True,
            pr_changed_files=["docs/specs/ARCHITECTURE.md"],
        )
        result = await retry_gate_node(state)
        assert result.workflow_stage == "awaiting_merge_approval"
        assert result.human_decision == ""

    @pytest.mark.asyncio
    async def test_failure_increments_retry_count(self) -> None:
        """Failure increments retry_count by exactly 1."""
        state = SDLCState(
            workflow_stage="coding_failed",
            retry_count=0,
            max_retries=3,
            test_passed=False,
        )
        result = await retry_gate_node(state)
        assert result.retry_count == 1
        assert result.workflow_stage == "dispatch_coding"

    @pytest.mark.asyncio
    async def test_failure_resets_test_state(self) -> None:
        """On retry, test state is cleared for fresh attempt."""
        state = SDLCState(
            workflow_stage="coding_failed",
            retry_count=0,
            max_retries=3,
            test_passed=False,
            test_workflow_run_id=12345,
            ac_compliance={"verdict": "FAIL"},
        )
        result = await retry_gate_node(state)
        assert result.test_passed is False
        assert result.test_workflow_run_id is None
        assert result.ac_compliance == {}

    @pytest.mark.asyncio
    async def test_max_retries_triggers_escalation(self) -> None:
        """When retry_count reaches max_retries → escalated."""
        state = SDLCState(
            workflow_stage="coding_failed",
            retry_count=2,
            max_retries=3,
            test_passed=False,
        )
        result = await retry_gate_node(state)
        assert result.workflow_stage == "escalated"
        assert result.retry_count == 3

    @pytest.mark.asyncio
    async def test_escalation_at_exact_boundary(self) -> None:
        """Escalation fires when new_count == max_retries (boundary check)."""
        state = SDLCState(
            workflow_stage="test_failed",
            retry_count=2,
            max_retries=3,
            test_passed=False,
        )
        result = await retry_gate_node(state)
        # new_retry_count = 2+1 = 3, which is >= max_retries(3)
        assert result.workflow_stage == "escalated"
        assert result.retry_count == 3

    @pytest.mark.asyncio
    async def test_no_escalation_below_max(self) -> None:
        """No escalation when retry_count < max_retries - 1."""
        state = SDLCState(
            workflow_stage="coding_failed",
            retry_count=1,
            max_retries=3,
            test_passed=False,
        )
        result = await retry_gate_node(state)
        assert result.workflow_stage == "dispatch_coding"
        assert result.retry_count == 2


class TestRouteAfterRetryGate:
    """Verify retry gate routing decisions."""

    def test_dispatch_testing_routes_to_test_lead(self) -> None:
        state = SDLCState(workflow_stage="dispatch_testing")
        assert route_after_retry_gate(state) == "test_lead"

    def test_dispatch_coding_routes_to_code_operator(self) -> None:
        state = SDLCState(workflow_stage="dispatch_coding")
        assert route_after_retry_gate(state) == "code_operator"

    def test_awaiting_merge_routes_to_scrum_master(self) -> None:
        state = SDLCState(
            workflow_stage="awaiting_merge_approval", human_decision="merge"
        )
        assert route_after_retry_gate(state) == "scrum_master"

    def test_awaiting_merge_without_decision_interrupts(self) -> None:
        state = SDLCState(
            workflow_stage="awaiting_merge_approval", human_decision=""
        )
        assert route_after_retry_gate(state) == "__interrupt__"

    def test_dispatch_architect_routes_to_architect(self) -> None:
        state = SDLCState(workflow_stage="dispatch_architect")
        assert route_after_retry_gate(state) == "architect"

    def test_escalated_routes_to_scrum_master(self) -> None:
        state = SDLCState(workflow_stage="escalated")
        assert route_after_retry_gate(state) == "scrum_master"

    def test_unknown_stage_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="unknown")
        assert route_after_retry_gate(state) == "__end__"


class TestGraphStructurePhase2:
    """Graph structure verification for Phase 2."""

    def test_graph_has_test_lead_node(self) -> None:
        from langgraph.checkpoint.memory import MemorySaver

        graph = build_graph(checkpointer=MemorySaver())
        node_names = set(graph.get_graph().nodes.keys())
        assert "test_lead" in node_names

    def test_graph_has_all_nodes(self) -> None:
        from langgraph.checkpoint.memory import MemorySaver

        graph = build_graph(checkpointer=MemorySaver())
        node_names = set(graph.get_graph().nodes.keys())
        assert "scrum_master" in node_names
        assert "code_operator" in node_names
        assert "architect" in node_names
        assert "test_lead" in node_names
        assert "retry_gate" in node_names
        assert "infra_lead" in node_names

    def test_graph_compiles_without_checkpointer(self) -> None:
        graph = build_graph(checkpointer=None)
        assert graph is not None


class TestRetryLoop:
    """Verify retry state transitions."""

    def test_retry_state_has_failure_report(self) -> None:
        """Test failure report is available for retry."""
        state = SDLCState(
            workflow_stage="coding_failed",
            retry_count=1,
            max_retries=3,
            test_failure_report="Missing idempotency check",
        )
        assert state.test_failure_report == "Missing idempotency check"
        assert state.retry_count < state.max_retries

    def test_max_retries_state(self) -> None:
        """After 3 retries, retry_count == max_retries."""
        state = SDLCState(
            workflow_stage="test_failed",
            retry_count=3,
            max_retries=3,
        )
        assert state.retry_count >= state.max_retries
