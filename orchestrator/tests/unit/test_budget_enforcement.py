"""Tests for TRA-28: Cost and budget enforcement.

Validates threshold alerts, hard stop behavior, and budget checking.
Budget pre-flight is now handled by the Scrum Master's check_budget tool
(not a separate gate in main.py).
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.nodes.scrum_master import _check_budget, _enforce_budget
from src.state import SDLCState


def _make_state(
    total_cost: float = 0.0,
    monthly_budget: float = 50.0,
    alerts_sent: list[float] | None = None,
    hard_stop: bool = True,
    thresholds: list[float] | None = None,
) -> SDLCState:
    """Create a state with configured budget parameters."""
    return SDLCState(
        cost_tracker={
            "entries": [],
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "total_cost_usd": total_cost,
        },
        budget_alerts_sent=alerts_sent or [],
        project_config={
            "cost_control": {
                "monthly_budget_usd": monthly_budget,
                "per_story_alert_usd": 2.0,
                "alert_thresholds": thresholds or [0.5, 0.8, 0.95],
                "hard_stop_at_budget": hard_stop,
                "claude_sonnet_input_per_mtok": 3.0,
                "claude_sonnet_output_per_mtok": 15.0,
            }
        },
    )


class TestCheckBudget:
    def test_returns_budget_status(self) -> None:
        import json
        state = _make_state(total_cost=25.0)
        result = json.loads(_check_budget(state))
        assert result["total_cost_usd"] == 25.0
        assert result["monthly_budget_usd"] == 50.0
        assert result["usage_percent"] == 50.0
        assert result["budget_remaining_usd"] == 25.0

    def test_zero_budget_handled(self) -> None:
        import json
        state = _make_state(total_cost=0.0, monthly_budget=0.0)
        result = json.loads(_check_budget(state))
        assert result["usage_percent"] == 0

    def test_story_alert_triggered(self) -> None:
        import json
        state = _make_state(total_cost=5.0)
        state.cost_tracker["entries"] = [
            {"agent": "scrum_master", "cost_usd": 2.5},
        ]
        result = json.loads(_check_budget(state))
        assert result["story_alert_triggered"] is True


class TestEnforceBudget:
    @pytest.mark.asyncio
    async def test_no_alerts_below_threshold(self) -> None:
        state = _make_state(total_cost=10.0)  # 20%
        slack = AsyncMock()
        cost_tracker = {"total_cost_usd": 10.0}

        updates, alerts = await _enforce_budget(state, slack, cost_tracker)
        assert updates == {}
        assert alerts == []

    @pytest.mark.asyncio
    async def test_50_percent_alert_fires(self) -> None:
        state = _make_state(total_cost=0.0)  # alerts_sent empty
        slack = AsyncMock()
        cost_tracker = {"total_cost_usd": 26.0}  # 52%

        updates, alerts = await _enforce_budget(state, slack, cost_tracker)
        assert 0.5 in alerts
        assert 0.8 not in alerts

    @pytest.mark.asyncio
    async def test_multiple_thresholds_fire_at_once(self) -> None:
        state = _make_state(total_cost=0.0)
        slack = AsyncMock()
        cost_tracker = {"total_cost_usd": 48.0}  # 96%

        updates, alerts = await _enforce_budget(state, slack, cost_tracker)
        assert 0.5 in alerts
        assert 0.8 in alerts
        assert 0.95 in alerts

    @pytest.mark.asyncio
    async def test_already_sent_alert_not_repeated(self) -> None:
        state = _make_state(total_cost=26.0, alerts_sent=[0.5])
        slack = AsyncMock()
        cost_tracker = {"total_cost_usd": 26.0}

        updates, alerts = await _enforce_budget(state, slack, cost_tracker)
        assert alerts.count(0.5) == 1  # Not duplicated

    @pytest.mark.asyncio
    async def test_hard_stop_at_100_percent(self) -> None:
        state = _make_state(total_cost=0.0, hard_stop=True)
        slack = AsyncMock()
        cost_tracker = {"total_cost_usd": 50.0}  # 100%

        updates, alerts = await _enforce_budget(state, slack, cost_tracker)
        assert updates.get("workflow_stage") == "budget_paused"

    @pytest.mark.asyncio
    async def test_soft_stop_at_100_percent(self) -> None:
        """hard_stop_at_budget: false should NOT pause the workflow."""
        state = _make_state(total_cost=0.0, hard_stop=False)
        slack = AsyncMock()
        cost_tracker = {"total_cost_usd": 50.0}

        updates, alerts = await _enforce_budget(state, slack, cost_tracker)
        assert "workflow_stage" not in updates

    @pytest.mark.asyncio
    async def test_over_budget_still_pauses(self) -> None:
        state = _make_state(total_cost=0.0, hard_stop=True)
        slack = AsyncMock()
        cost_tracker = {"total_cost_usd": 60.0}  # 120%

        updates, alerts = await _enforce_budget(state, slack, cost_tracker)
        assert updates.get("workflow_stage") == "budget_paused"


    # Budget pre-flight is now handled by the Scrum Master's check_budget
    # tool and _enforce_budget within the graph, not by a separate gate in
    # main.py. See scrum_master.py system prompt for budget pre-flight rules.
