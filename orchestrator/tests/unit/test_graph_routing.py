"""Unit tests for graph routing logic.

Spec ref: AgenticSquad_Functional_Spec v2.8 RC §16.1
"""

import pytest

from src.graph import (
    route_after_scrum_master,
    route_after_code_operator,
    route_after_infra_lead,
    build_graph,
)
from src.state import SDLCState


# ── Routing function unit tests ──


class TestRouteAfterScrumMaster:
    def test_dispatch_coding_routes_to_code_operator(self) -> None:
        state = SDLCState(workflow_stage="dispatch_coding")
        assert route_after_scrum_master(state) == "code_operator"

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

    def test_budget_paused_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="budget_paused")
        assert route_after_scrum_master(state) == "__end__"

    def test_escalated_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="escalated")
        assert route_after_scrum_master(state) == "__end__"

    def test_idle_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="idle")
        assert route_after_scrum_master(state) == "__end__"

    def test_unknown_stage_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="unknown_stage")
        assert route_after_scrum_master(state) == "__end__"


class TestRouteAfterCodeOperator:
    def test_pr_found_routes_to_retry_gate(self) -> None:
        state = SDLCState(pr_number=87)
        assert route_after_code_operator(state) == "retry_gate"

    def test_error_routes_to_retry_gate(self) -> None:
        state = SDLCState(
            error_context={"error_type": "job_dispatch_failure"}
        )
        assert route_after_code_operator(state) == "retry_gate"

    def test_no_pr_no_error_routes_to_retry_gate(self) -> None:
        state = SDLCState()
        assert route_after_code_operator(state) == "retry_gate"


# ── Graph structure tests ──


class TestGraphStructure:
    def test_graph_has_required_nodes(self) -> None:
        from langgraph.checkpoint.memory import MemorySaver

        graph = build_graph(checkpointer=MemorySaver())
        node_names = set(graph.get_graph().nodes.keys())
        assert "scrum_master" in node_names
        assert "code_operator" in node_names

    def test_graph_compiles_without_checkpointer(self) -> None:
        graph = build_graph(checkpointer=None)
        assert graph is not None


# ── TRA-91: Ad-hoc infra query routing ──


class TestInfraQueryRouting:
    def test_dispatch_infra_query_routes_to_infra_lead(self) -> None:
        """SM dispatches infra query → routes to Infra Lead."""
        state = SDLCState(
            workflow_stage="dispatch_infra_query",
            infra_query="Check VPS container health",
        )
        assert route_after_scrum_master(state) == "infra_lead"

    def test_infra_query_complete_routes_to_scrum_master(self) -> None:
        """Infra Lead completes ad-hoc query → routes back to SM."""
        state = SDLCState(
            workflow_stage="infra_query_complete",
            infra_query="Check VPS container health",
        )
        assert route_after_infra_lead(state) == "scrum_master"

    def test_merged_still_routes_to_infra_lead(self) -> None:
        """Existing deploy flow unchanged: merged → Infra Lead."""
        state = SDLCState(workflow_stage="merged")
        assert route_after_scrum_master(state) == "infra_lead"

    def test_deploy_complete_routes_to_scrum_master(self) -> None:
        """Deploy flow: Infra Lead deployed → SM."""
        state = SDLCState(
            workflow_stage="deployed",
            deploy_status="succeeded",
            infra_query="",
        )
        assert route_after_infra_lead(state) == "scrum_master"
