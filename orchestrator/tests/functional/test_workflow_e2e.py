"""Functional end-to-end tests for the LangGraph workflow.

Tests verify that ALL Slack messages are routed through the graph to the
Scrum Master, with no hardcoded command parsing in main.py. Only
intervention commands (/pause, /resume, /cancel) are handled outside the graph.

Spec ref: AgenticSquad_Functional_Spec v3.1 §11.2
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.graph import build_graph
from src.state import SDLCState
from src.main import handle_slack_message, _build_state_with_carryover


# ── Helpers ──


def _mock_issue(
    number: int = 42, title: str = "Fix the widget", body: str = "Details here"
):
    """Create a mock GitHub issue."""
    issue = MagicMock()
    issue.number = number
    issue.title = title
    issue.body = body
    label = MagicMock()
    label.name = "status/ready-for-dev"
    issue.labels = [label]
    return issue


def _mock_pr(
    number: int = 99,
    html_url: str = "https://github.com/test/repo/pull/99",
):
    """Create a mock GitHub PR."""
    pr = MagicMock()
    pr.number = number
    pr.html_url = html_url
    pr.title = "feat: implement issue #42"
    pr.state = "open"
    pr.merged = False
    pr.mergeable = True
    pr.head = MagicMock()
    pr.head.ref = "feat/issue-42"
    return pr


def _mock_github_client(issue=None, pr=None):
    """Build a mock GitHubClient."""
    client = MagicMock()
    client.get_issue.return_value = issue or _mock_issue()
    client.get_issues_by_label.return_value = [issue or _mock_issue()]
    client.update_issue_labels.return_value = None
    client.close_issue.return_value = None
    client.generate_installation_token.return_value = "ghs_fake_token_123"
    client.find_pr_for_branch.return_value = pr
    client.create_pr.return_value = pr or _mock_pr()
    client.merge_pr.return_value = None
    client.get_pr.return_value = pr or _mock_pr()
    client.get_pr_diff.return_value = "--- file.py\n+++ file.py\n+new line"
    client.append_to_document.return_value = "Appended to docs/AGENT_MEMORY.md"
    return client


def _mock_slack_client():
    """Build a mock SlackClient with async post."""
    client = MagicMock()
    client.post = AsyncMock()
    return client


def _mock_graph(
    lobby_values: dict | None = None,
    thread_values: dict | None = None,
    interrupted: bool = False,
) -> MagicMock:
    """Build a mock graph with configurable state snapshots."""
    graph = MagicMock()
    graph.ainvoke = AsyncMock()
    graph.aupdate_state = AsyncMock()

    def make_snapshot(values: dict | None, is_interrupted: bool = False):
        snap = MagicMock()
        snap.values = values
        snap.next = ("scrum_master",) if is_interrupted else ()
        return snap

    lobby_snap = make_snapshot(lobby_values)
    thread_snap = make_snapshot(thread_values, interrupted)

    async def mock_aget_state(config):
        tid = config.get("configurable", {}).get("thread_id", "")
        if tid == "lobby":
            return lobby_snap
        return thread_snap

    graph.aget_state = AsyncMock(side_effect=mock_aget_state)
    return graph


# ── All messages route to graph ──


class TestAllMessagesRouteToGraph:
    """Every message goes to the Scrum Master via graph invocation."""

    @pytest.mark.asyncio
    async def test_ping_routes_to_graph(self) -> None:
        """'ping' is handled by the Scrum Master, not hardcoded."""
        graph = _mock_graph()
        with patch("src.main.SlackClient"):
            await handle_slack_message("ping", graph, {})
        graph.ainvoke.assert_called_once()
        state = graph.ainvoke.call_args[0][0]
        assert state.messages[0]["content"] == "ping"

    @pytest.mark.asyncio
    async def test_status_routes_to_graph(self) -> None:
        """'status' is handled by the Scrum Master, not hardcoded."""
        graph = _mock_graph()
        with patch("src.main.SlackClient"):
            await handle_slack_message("status", graph, {})
        graph.ainvoke.assert_called_once()
        state = graph.ainvoke.call_args[0][0]
        assert state.messages[0]["content"] == "status"

    @pytest.mark.asyncio
    async def test_pick_up_issue_routes_to_graph(self) -> None:
        """'pick up issue #42' is handled by the Scrum Master."""
        graph = _mock_graph()
        with patch("src.main.SlackClient"):
            await handle_slack_message("pick up issue #42", graph, {})
        graph.ainvoke.assert_called_once()
        state = graph.ainvoke.call_args[0][0]
        assert state.messages[0]["content"] == "pick up issue #42"

    @pytest.mark.asyncio
    async def test_merge_routes_to_graph(self) -> None:
        """'merge' is handled by the Scrum Master via approve_merge tool."""
        graph = _mock_graph()
        with patch("src.main.SlackClient"):
            await handle_slack_message("merge", graph, {})
        graph.ainvoke.assert_called_once()

    @pytest.mark.asyncio
    async def test_natural_language_routes_to_graph(self) -> None:
        """Natural language goes to the Scrum Master."""
        graph = _mock_graph()
        with patch("src.main.SlackClient"):
            await handle_slack_message("What issues are ready?", graph, {})
        graph.ainvoke.assert_called_once()
        state = graph.ainvoke.call_args[0][0]
        assert state.messages[0]["content"] == "What issues are ready?"


# ── Lobby thread: no active story ──


class TestLobbyThread:
    """When no active story exists, messages go to the lobby thread."""

    @pytest.mark.asyncio
    async def test_lobby_thread_used_when_no_active_story(self) -> None:
        graph = _mock_graph(lobby_values={})
        with patch("src.main.SlackClient"):
            await handle_slack_message("hello", graph, {})
        config = graph.ainvoke.call_args[0][1]
        assert config["configurable"]["thread_id"] == "lobby"

    @pytest.mark.asyncio
    async def test_state_starts_idle(self) -> None:
        graph = _mock_graph()
        with patch("src.main.SlackClient"):
            await handle_slack_message("plan the next sprint", graph, {})
        state = graph.ainvoke.call_args[0][0]
        assert state.workflow_stage == "idle"


# ── Active story thread ──


class TestActiveStoryThread:
    """When an active story exists, messages route to its thread."""

    @pytest.mark.asyncio
    async def test_active_story_thread_used(self) -> None:
        graph = _mock_graph(
            lobby_values={"active_story_thread_id": "story-42"},
            thread_values={"workflow_stage": "dispatch_coding", "current_issue_number": 42},
        )
        with patch("src.main.SlackClient"):
            await handle_slack_message("what's the status?", graph, {})
        config = graph.ainvoke.call_args[0][1]
        assert config["configurable"]["thread_id"] == "story-42"

    @pytest.mark.asyncio
    async def test_terminal_story_falls_back_to_lobby(self) -> None:
        """If the active story is done, fall back to lobby."""
        graph = _mock_graph(
            lobby_values={"active_story_thread_id": "story-42"},
            thread_values={"workflow_stage": "done", "current_issue_number": 42},
        )
        with patch("src.main.SlackClient"):
            await handle_slack_message("pick up next issue", graph, {})
        config = graph.ainvoke.call_args[0][1]
        assert config["configurable"]["thread_id"] == "lobby"


# ── Interrupt handling ──


class TestInterruptHandling:
    """When graph is at an interrupt, messages inject and resume."""

    @pytest.mark.asyncio
    async def test_interrupt_injects_and_resumes(self) -> None:
        graph = _mock_graph(
            lobby_values={"active_story_thread_id": "story-42"},
            thread_values={
                "workflow_stage": "awaiting_merge_approval",
                "current_issue_number": 42,
            },
            interrupted=True,
        )
        with patch("src.main.SlackClient"):
            await handle_slack_message("merge", graph, {})

        # Should inject message via aupdate_state then resume
        graph.aupdate_state.assert_called()
        update_call = graph.aupdate_state.call_args_list[0]
        assert update_call[0][0] == {"configurable": {"thread_id": "story-42"}}
        assert update_call[0][1]["messages"][0]["content"] == "merge"

        # Should resume the graph (ainvoke with None)
        graph.ainvoke.assert_called()
        assert graph.ainvoke.call_args_list[0][0][0] is None

    @pytest.mark.asyncio
    async def test_question_at_interrupt_also_reaches_sm(self) -> None:
        """Non-merge messages at interrupt still reach the SM."""
        graph = _mock_graph(
            lobby_values={"active_story_thread_id": "story-42"},
            thread_values={
                "workflow_stage": "awaiting_merge_approval",
                "current_issue_number": 42,
            },
            interrupted=True,
        )
        with patch("src.main.SlackClient"):
            await handle_slack_message("what's the risk tier?", graph, {})

        # Message injected into graph state
        update_call = graph.aupdate_state.call_args_list[0]
        assert update_call[0][1]["messages"][0]["content"] == "what's the risk tier?"


# ── State carryover ──


class TestStateCarryover:
    """State carryover preserves durable fields across invocations."""

    def test_carries_over_story_context(self) -> None:
        prev = {
            "current_issue_number": 42,
            "pr_number": 99,
            "pr_url": "https://github.com/test/repo/pull/99",
            "cost_tracker": {"total_cost_usd": 5.0},
            "budget_alerts_sent": [0.5],
        }
        state = _build_state_with_carryover(prev, {}, "hello")
        assert state.current_issue_number == 42
        assert state.pr_number == 99
        assert state.cost_tracker == {"total_cost_usd": 5.0}
        assert state.budget_alerts_sent == [0.5]
        assert state.workflow_stage == "idle"
        assert state.messages[0]["content"] == "hello"

    def test_empty_prev_gives_defaults(self) -> None:
        state = _build_state_with_carryover({}, {"cost_control": {}}, "hi")
        assert state.current_issue_number is None
        assert state.pr_number is None
        assert state.cost_tracker == {}
        assert state.messages[0]["content"] == "hi"


# ── Pause gate ──


class TestPauseGate:
    @pytest.mark.asyncio
    async def test_paused_blocks_all_messages(self) -> None:
        from src.main import set_workforce_paused
        set_workforce_paused(True)
        graph = _mock_graph()
        with patch("src.main.SlackClient") as MockSlack:
            mock_slack = MagicMock(post=AsyncMock())
            MockSlack.return_value = mock_slack
            await handle_slack_message("pick up issue #42", graph, {})
            graph.ainvoke.assert_not_called()
            assert "paused" in mock_slack.post.call_args[0][0].lower()
        set_workforce_paused(False)


# ── Real config validation ──


class TestConfigLoading:
    """Test that the real config/trading-agent.yaml loads correctly."""

    def test_real_config_loads(self) -> None:
        from pathlib import Path
        from src.config_loader import load_project_config

        config_path = (
            Path(__file__).resolve().parents[2] / "config" / "trading-agent.yaml"
        )
        config = load_project_config(str(config_path))
        assert config["project"]["name"] == "trading-agent"
        assert config["project"]["repo"] == "stepan-korec/trading-agent"
        assert config["cost_control"]["monthly_budget_usd"] == 50.0
        assert config["execution"]["backend"] == "vps"
        assert config["execution"]["max_retries"] == 3

    def test_real_config_smoke_test_section(self) -> None:
        from pathlib import Path
        from src.config_loader import load_project_config

        config_path = (
            Path(__file__).resolve().parents[2] / "config" / "trading-agent.yaml"
        )
        config = load_project_config(str(config_path))
        assert config["smoke_test"]["enabled"] is True
        assert "SMOKE" in config["smoke_test"]["story"]["title"]
