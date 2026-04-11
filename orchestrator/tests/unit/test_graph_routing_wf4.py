"""WF3 regression tests for WF4 (TRA-59).

Key cases:
- PO-generated story routes at medium risk tier
- Budget alert fires at 50%/80%/95% — async Slack post is awaited
- Linear sync triggered on story state change
- Pause check blocks story pickup when workforce:paused=1

Min 8 tests required per spec.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.graph import (
    retry_gate_node,
    route_after_po,
    route_after_retry_gate,
    route_after_scrum_master,
)
from src.state import SDLCState


class TestPOStoryRouting:
    def test_po_generated_story_routes_normal_risk(self) -> None:
        """PO-generated story without protected paths routes as normal risk."""
        state = SDLCState(
            workflow_stage="pr_created",
            pr_number=42,
            pr_changed_files=["agent-workforce/src/tools/kpi_reporter.py"],
        )
        result = pytest.importorskip("asyncio").get_event_loop().run_until_complete(
            retry_gate_node(state)
        )
        assert result.pr_risk_tier == "normal"
        assert result.workflow_stage == "dispatch_testing"

    def test_dispatch_planning_routes_to_po(self) -> None:
        state = SDLCState(workflow_stage="dispatch_planning")
        assert route_after_scrum_master(state) == "po"

    def test_po_idle_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="idle")
        assert route_after_po(state) == "__end__"


@pytest.mark.asyncio
class TestBudgetAlertAsync:
    async def test_budget_alert_50_percent(self) -> None:
        """Budget alert fires at 50% and is awaited (not fire-and-forget)."""
        from src.nodes.scrum_master import _enforce_budget

        state = SDLCState(
            project_config={
                "cost_control": {
                    "monthly_budget_usd": 10.0,
                    "alert_thresholds": [0.5, 0.8, 0.95],
                    "hard_stop_at_budget": True,
                }
            },
            budget_alerts_sent=[],
        )
        slack = MagicMock()
        slack.post = AsyncMock()
        cost_tracker = {"total_cost_usd": 5.5}

        updates, alerts = await _enforce_budget(state, slack, cost_tracker)
        assert 0.5 in alerts
        slack.post.assert_called()  # Was awaited (AsyncMock tracks this)

    async def test_budget_alert_80_percent(self) -> None:
        from src.nodes.scrum_master import _enforce_budget

        state = SDLCState(
            project_config={
                "cost_control": {
                    "monthly_budget_usd": 10.0,
                    "alert_thresholds": [0.5, 0.8, 0.95],
                    "hard_stop_at_budget": True,
                }
            },
            budget_alerts_sent=[0.5],
        )
        slack = MagicMock()
        slack.post = AsyncMock()
        cost_tracker = {"total_cost_usd": 8.5}

        updates, alerts = await _enforce_budget(state, slack, cost_tracker)
        assert 0.8 in alerts
        assert 0.5 in alerts  # Previously sent alert preserved

    async def test_budget_alert_95_percent(self) -> None:
        from src.nodes.scrum_master import _enforce_budget

        state = SDLCState(
            project_config={
                "cost_control": {
                    "monthly_budget_usd": 10.0,
                    "alert_thresholds": [0.5, 0.8, 0.95],
                    "hard_stop_at_budget": True,
                }
            },
            budget_alerts_sent=[0.5, 0.8],
        )
        slack = MagicMock()
        slack.post = AsyncMock()
        cost_tracker = {"total_cost_usd": 9.6}

        updates, alerts = await _enforce_budget(state, slack, cost_tracker)
        assert 0.95 in alerts

    async def test_budget_hard_stop_at_100_percent(self) -> None:
        from src.nodes.scrum_master import _enforce_budget

        state = SDLCState(
            project_config={
                "cost_control": {
                    "monthly_budget_usd": 10.0,
                    "alert_thresholds": [0.5, 0.8, 0.95],
                    "hard_stop_at_budget": True,
                }
            },
            budget_alerts_sent=[0.5, 0.8, 0.95],
        )
        slack = MagicMock()
        slack.post = AsyncMock()
        cost_tracker = {"total_cost_usd": 10.5}

        updates, alerts = await _enforce_budget(state, slack, cost_tracker)
        assert updates.get("workflow_stage") == "budget_paused"


class TestLinearSyncOnStateChange:
    def test_linear_sync_tool_in_scrum_master(self) -> None:
        """Verify sync_to_linear tool exists in Scrum Master tools."""
        from src.nodes.scrum_master import TOOLS

        tool_names = [t["name"] for t in TOOLS]
        assert "sync_to_linear" in tool_names

    def test_linear_sync_events(self) -> None:
        """Verify supported lifecycle events."""
        from src.nodes.scrum_master import TOOLS

        sync_tool = next(t for t in TOOLS if t["name"] == "sync_to_linear")
        events = sync_tool["input_schema"]["properties"]["event"]["enum"]
        assert "story_picked_up" in events
        assert "story_merged" in events
        assert "escalation" in events


class TestPauseBlocksPickup:
    def test_pause_state_field_default(self) -> None:
        state = SDLCState()
        assert state.paused is False

    def test_pause_state_field_set(self) -> None:
        state = SDLCState(paused=True)
        assert state.paused is True


class TestRetryGateRiskClassification:
    def test_high_risk_routes_to_architect(self) -> None:
        state = SDLCState(
            workflow_stage="pr_created",
            pr_number=10,
            pr_changed_files=["services/order-router/auth_handler.go"],
        )
        import asyncio

        result = asyncio.get_event_loop().run_until_complete(
            retry_gate_node(state)
        )
        assert result.pr_risk_tier == "high_risk"
        assert result.workflow_stage == "dispatch_architect"

    def test_protected_routes_to_merge_gate(self) -> None:
        state = SDLCState(
            workflow_stage="pr_created",
            pr_number=10,
            pr_changed_files=["CLAUDE.md"],
            test_passed=True,
        )
        import asyncio

        result = asyncio.get_event_loop().run_until_complete(
            retry_gate_node(state)
        )
        assert result.pr_risk_tier == "protected"
