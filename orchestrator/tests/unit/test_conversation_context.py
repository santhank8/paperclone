"""Regression tests for conversation context preservation (IR-002).

Verifies that the lobby thread message handler preserves conversational
context across multiple invocations, fixing the amnesia bug where the SM
lost all context between messages.

Spec ref: §13.3 — lobby thread multi-turn context
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.main import _build_state_with_carryover, handle_slack_message
from src.state import SDLCState


class TestBuildStateWithCarryover:
    """Verify _build_state_with_carryover preserves message history."""

    def test_first_message_creates_single_entry(self) -> None:
        """First message on empty lobby creates messages with one entry."""
        state = _build_state_with_carryover(
            prev={},
            project_config={"project": {"name": "test"}},
            user_message="hello",
        )
        assert len(state.messages) == 1
        assert state.messages[0] == {"role": "user", "content": "hello"}

    def test_second_message_appends_to_history(self) -> None:
        """Second message appends to existing conversation history."""
        prev = {
            "messages": [
                {"role": "user", "content": "hello"},
                {"role": "assistant", "content": "Hi! How can I help?"},
            ],
        }
        state = _build_state_with_carryover(
            prev=prev,
            project_config={"project": {"name": "test"}},
            user_message="check VPS health",
        )
        assert len(state.messages) == 3
        assert state.messages[0] == {"role": "user", "content": "hello"}
        assert state.messages[1] == {"role": "assistant", "content": "Hi! How can I help?"}
        assert state.messages[2] == {"role": "user", "content": "check VPS health"}

    def test_three_message_context_reference_preserved(self) -> None:
        """IR-002 regression: message 3 can reference something from message 1.

        Simulates the exact failure scenario from IR-002 where the SM
        couldn't resolve 'the issue' from a prior message because context
        was lost.
        """
        # Message 1: User asks about infra
        # Message 2 (assistant): Reports 401 error from Infra Lead
        # Message 3: User says "let's address the issue"
        prev = {
            "messages": [
                {"role": "user", "content": "What infrastructure are you managing?"},
                {
                    "role": "assistant",
                    "content": "The Infra Lead reports a 401 authentication error on the MCP server.",
                },
            ],
        }
        state = _build_state_with_carryover(
            prev=prev,
            project_config={"project": {"name": "test"}},
            user_message="Let's address the issue",
        )
        # SM should have all 3 messages — can resolve "the issue" from context
        assert len(state.messages) == 3
        assert "401" in state.messages[1]["content"]
        assert state.messages[2]["content"] == "Let's address the issue"

    def test_does_not_mutate_previous_state(self) -> None:
        """Carrying over messages must not mutate the prev dict."""
        prev_messages = [{"role": "user", "content": "hello"}]
        prev = {"messages": prev_messages}
        _build_state_with_carryover(
            prev=prev,
            project_config={},
            user_message="world",
        )
        # Original list should be unchanged
        assert len(prev_messages) == 1

    def test_carries_over_durable_fields(self) -> None:
        """Durable fields (cost_tracker, etc.) are preserved alongside messages."""
        prev = {
            "messages": [{"role": "user", "content": "hello"}],
            "cost_tracker": {"total_cost_usd": 1.5},
            "current_issue_number": 42,
        }
        state = _build_state_with_carryover(
            prev=prev,
            project_config={},
            user_message="status",
        )
        assert len(state.messages) == 2
        assert state.cost_tracker == {"total_cost_usd": 1.5}
        assert state.current_issue_number == 42


class TestCreateGithubIssueTool:
    """Verify create_github_issue tool is available in SM tools."""

    def test_create_github_issue_tool_exists(self) -> None:
        """IR-002 F5: SM must have create_github_issue in its tool list."""
        from src.nodes.scrum_master import TOOLS

        tool_names = [t["name"] for t in TOOLS]
        assert "create_github_issue" in tool_names

    def test_create_github_issue_requires_title_and_body(self) -> None:
        """create_github_issue must require title and body."""
        from src.nodes.scrum_master import TOOLS

        tool = next(t for t in TOOLS if t["name"] == "create_github_issue")
        assert "title" in tool["input_schema"]["required"]
        assert "body" in tool["input_schema"]["required"]


class TestSystemPromptFixes:
    """Verify SM system prompt improvements from IR-002."""

    def test_platform_overview_present(self) -> None:
        """IR-002 F1: SM prompt must include platform overview."""
        from src.nodes.scrum_master import SYSTEM_PROMPT

        assert "Platform Overview" in SYSTEM_PROMPT

    def test_never_redirect_human_rule(self) -> None:
        """IR-002 F5: SM must not tell human to do things SM can do."""
        from src.nodes.scrum_master import SYSTEM_PROMPT

        assert "NEVER tell the human to do something you have a tool for" in SYSTEM_PROMPT

    def test_never_contact_anyone_rule(self) -> None:
        """IR-002: SM must not tell human to contact anyone."""
        from src.nodes.scrum_master import SYSTEM_PROMPT

        assert 'NEVER tell the human to "contact"' in SYSTEM_PROMPT

    def test_no_pre_announce_dispatches_rule(self) -> None:
        """IR-001/IR-002 F2/F3: SM must not pre-announce agent dispatches."""
        from src.nodes.scrum_master import SYSTEM_PROMPT

        assert "NEVER pre-announce agent dispatches" in SYSTEM_PROMPT

    def test_conversation_context_rule(self) -> None:
        """IR-002 F4/F6: SM must resolve references from conversation history."""
        from src.nodes.scrum_master import SYSTEM_PROMPT

        assert "conversation history" in SYSTEM_PROMPT.lower()
