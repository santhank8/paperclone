"""Tests for intervention commands (TRA-56/57/58).

Min 10 tests required per spec.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.main import (
    _handle_intervention,
    get_active_job_run_id,
    handle_slack_message,
    is_workforce_paused,
    set_active_job_run_id,
    set_workforce_paused,
)
from src.tools.slack_client import parse_intervention_command


class TestParseInterventionCommand:
    def test_pause_command(self) -> None:
        assert parse_intervention_command("/pause") == ("pause", {})

    def test_pause_without_slash(self) -> None:
        assert parse_intervention_command("pause") == ("pause", {})

    def test_resume_command(self) -> None:
        assert parse_intervention_command("/resume") == ("resume", {})

    def test_cancel_command(self) -> None:
        assert parse_intervention_command("/cancel") == ("cancel", {})

    def test_status_command_with_slash(self) -> None:
        assert parse_intervention_command("/status") == ("status", {})

    def test_bare_status_is_not_intervention(self) -> None:
        """Bare 'status' routes to graph Scrum Master, not intervention."""
        assert parse_intervention_command("status") is None

    def test_non_intervention_returns_none(self) -> None:
        assert parse_intervention_command("hello world") is None

    def test_pick_up_issue_is_not_intervention(self) -> None:
        assert parse_intervention_command("pick up issue #42") is None

    def test_case_insensitive(self) -> None:
        assert parse_intervention_command("PAUSE") == ("pause", {})
        assert parse_intervention_command("Resume") == ("resume", {})


class TestPauseState:
    def setup_method(self) -> None:
        set_workforce_paused(False)
        set_active_job_run_id(None)

    def test_default_not_paused(self) -> None:
        assert is_workforce_paused() is False

    def test_set_paused(self) -> None:
        set_workforce_paused(True)
        assert is_workforce_paused() is True

    def test_resume_clears_pause(self) -> None:
        set_workforce_paused(True)
        set_workforce_paused(False)
        assert is_workforce_paused() is False


class TestActiveJobRunId:
    def setup_method(self) -> None:
        set_active_job_run_id(None)

    def test_default_none(self) -> None:
        assert get_active_job_run_id() is None

    def test_set_and_get(self) -> None:
        set_active_job_run_id("12345")
        assert get_active_job_run_id() == "12345"

    def test_clear(self) -> None:
        set_active_job_run_id("12345")
        set_active_job_run_id(None)
        assert get_active_job_run_id() is None


@pytest.mark.asyncio
class TestHandleInterventionPause:
    async def test_pause_sets_flag(self) -> None:
        set_workforce_paused(False)
        slack = MagicMock()
        slack.post = AsyncMock()
        await _handle_intervention("pause", slack, None, {})
        assert is_workforce_paused() is True
        slack.post.assert_called_once()
        assert "paused" in slack.post.call_args[0][0].lower()

    async def test_resume_clears_flag(self) -> None:
        set_workforce_paused(True)
        slack = MagicMock()
        slack.post = AsyncMock()
        await _handle_intervention("resume", slack, None, {})
        assert is_workforce_paused() is False
        slack.post.assert_called_once()
        assert "resumed" in slack.post.call_args[0][0].lower()


@pytest.mark.asyncio
class TestHandleInterventionCancel:
    async def test_cancel_with_no_active_job(self) -> None:
        set_active_job_run_id(None)
        slack = MagicMock()
        slack.post = AsyncMock()
        await _handle_intervention("cancel", slack, None, {})
        slack.post.assert_called_once()
        assert "no active" in slack.post.call_args[0][0].lower()

    @patch("src.main.subprocess.run")
    async def test_cancel_with_active_job(self, mock_run: MagicMock) -> None:
        set_active_job_run_id("99999")
        mock_run.return_value = MagicMock(returncode=0)
        slack = MagicMock()
        slack.post = AsyncMock()
        await _handle_intervention("cancel", slack, None, {})
        mock_run.assert_called_once()
        assert get_active_job_run_id() is None
        assert "cancelled" in slack.post.call_args[0][0].lower()

    @patch("src.main.subprocess.run")
    async def test_cancel_failure(self, mock_run: MagicMock) -> None:
        set_active_job_run_id("99999")
        mock_run.return_value = MagicMock(
            returncode=1, stderr="not found"
        )
        slack = MagicMock()
        slack.post = AsyncMock()
        await _handle_intervention("cancel", slack, None, {})
        # Run ID should NOT be cleared on failure
        assert get_active_job_run_id() == "99999"


@pytest.mark.asyncio
class TestHandleInterventionStatus:
    async def test_status_when_idle(self) -> None:
        set_workforce_paused(False)
        set_active_job_run_id(None)
        slack = MagicMock()
        slack.post = AsyncMock()

        # Mock graph with no active story in lobby
        graph = MagicMock()
        lobby_snap = MagicMock()
        lobby_snap.values = {}
        lobby_snap.next = ()
        graph.aget_state = AsyncMock(return_value=lobby_snap)

        await _handle_intervention(
            "status", slack, graph, {"cost_control": {"monthly_budget_usd": 50.0}}
        )
        slack.post.assert_called_once()
        msg = slack.post.call_args[0][0]
        assert "Paused" in msg
        assert "No" in msg  # Not paused

    async def test_status_shows_paused_when_paused(self) -> None:
        set_workforce_paused(True)
        slack = MagicMock()
        slack.post = AsyncMock()

        graph = MagicMock()
        lobby_snap = MagicMock()
        lobby_snap.values = {}
        lobby_snap.next = ()
        graph.aget_state = AsyncMock(return_value=lobby_snap)

        await _handle_intervention(
            "status", slack, graph, {"cost_control": {"monthly_budget_usd": 50.0}}
        )
        msg = slack.post.call_args[0][0]
        assert "Yes" in msg


@pytest.mark.asyncio
class TestPickupBlockedByPause:
    async def test_pick_up_blocked_when_paused(self) -> None:
        set_workforce_paused(True)
        graph = MagicMock()
        with patch("src.main.SlackClient") as MockSlack:
            slack_instance = MagicMock()
            slack_instance.post = AsyncMock()
            MockSlack.return_value = slack_instance
            await handle_slack_message("pick up issue #42", graph, {})
            # Graph should NOT be invoked
            graph.ainvoke.assert_not_called()
            slack_instance.post.assert_called_once()
            assert "paused" in slack_instance.post.call_args[0][0].lower()
        set_workforce_paused(False)
