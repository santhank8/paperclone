"""Tests for WF3 graph routing additions.

Validates PO routing and dispatch_planning stage.
"""

from src.graph import route_after_scrum_master, route_after_po
from src.state import SDLCState


class TestRouteAfterScrumMasterWF3:
    def test_dispatch_planning_routes_to_po(self) -> None:
        state = SDLCState(workflow_stage="dispatch_planning")
        assert route_after_scrum_master(state) == "po"


class TestRouteAfterPO:
    def test_idle_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="idle")
        assert route_after_po(state) == "__end__"

    def test_done_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="done")
        assert route_after_po(state) == "__end__"

    def test_other_stage_routes_to_scrum_master(self) -> None:
        state = SDLCState(workflow_stage="dispatch_coding")
        assert route_after_po(state) == "scrum_master"


class TestNewStateFields:
    def test_budget_alerts_sent_default(self) -> None:
        state = SDLCState()
        assert state.budget_alerts_sent == []

    def test_document_registry_default(self) -> None:
        state = SDLCState()
        assert state.document_registry == {}

    def test_allowed_documents_default(self) -> None:
        state = SDLCState()
        assert state.allowed_documents == []

    def test_planning_direction_default(self) -> None:
        state = SDLCState()
        assert state.planning_direction == ""

    def test_linear_issue_id_default(self) -> None:
        state = SDLCState()
        assert state.linear_issue_id == ""
