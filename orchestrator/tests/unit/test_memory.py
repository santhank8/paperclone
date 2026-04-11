"""Test memory management — sliding window and serialization.

Spec ref: Phase 2 RFC — Track H
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.memory import (
    manage_message_history,
    _serialize_messages,
    MAX_MESSAGES,
    SUMMARY_THRESHOLD,
)


class TestSerializeMessages:
    """Test message serialization for summarization."""

    def test_serialize_simple_text_messages(self) -> None:
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there"},
        ]
        result = _serialize_messages(messages)
        assert "user: Hello" in result
        assert "assistant: Hi there" in result

    def test_serialize_tool_result_messages(self) -> None:
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": "123",
                        "content": "Issue #42 found",
                    }
                ],
            },
        ]
        result = _serialize_messages(messages)
        assert "Tool result" in result
        assert "Issue #42" in result

    def test_serialize_tool_use_messages(self) -> None:
        messages = [
            {
                "role": "assistant",
                "content": [
                    {"type": "tool_use", "name": "get_issue_details"},
                ],
            },
        ]
        result = _serialize_messages(messages)
        assert "Tool call: get_issue_details" in result

    def test_serialize_text_block_messages(self) -> None:
        messages = [
            {
                "role": "assistant",
                "content": [
                    {"type": "text", "text": "Let me check that for you."},
                ],
            },
        ]
        result = _serialize_messages(messages)
        assert "Let me check that" in result

    def test_serialize_truncates_long_content(self) -> None:
        messages = [
            {"role": "user", "content": "x" * 1000},
        ]
        result = _serialize_messages(messages)
        # Content should be truncated to 300 chars
        assert len(result) <= 400  # role prefix + truncated content

    def test_serialize_empty_messages(self) -> None:
        result = _serialize_messages([])
        assert result == ""

    def test_serialize_tool_calls_format(self) -> None:
        """New format: tool_calls in assistant message dict."""
        messages = [
            {
                "role": "assistant",
                "content": "Looking that up",
                "tool_calls": [
                    {"name": "get_open_issues", "args": {}, "id": "tc_1"},
                ],
            },
        ]
        result = _serialize_messages(messages)
        assert "Tools: get_open_issues" in result

    def test_serialize_tool_message_format(self) -> None:
        """New format: tool role message."""
        messages = [
            {
                "role": "tool",
                "content": "Found 3 issues",
                "tool_call_id": "tc_1",
            },
        ]
        result = _serialize_messages(messages)
        assert "tool: Found 3 issues" in result


class TestManageMessageHistory:
    """Test sliding window with LLM summarization."""

    @pytest.mark.asyncio
    async def test_under_threshold_returns_as_is(self) -> None:
        """Messages under SUMMARY_THRESHOLD should be returned unchanged."""
        messages = [
            {"role": "user", "content": f"Message {i}"}
            for i in range(10)
        ]
        result = await manage_message_history(messages)
        assert result == messages

    @pytest.mark.asyncio
    async def test_just_below_threshold_returns_as_is(self) -> None:
        """SUMMARY_THRESHOLD - 1 messages should be returned unchanged."""
        messages = [
            {"role": "user", "content": f"Message {i}"}
            for i in range(SUMMARY_THRESHOLD - 1)
        ]
        result = await manage_message_history(messages)
        assert result == messages

    @pytest.mark.asyncio
    async def test_at_threshold_triggers_summarization(self) -> None:
        """Exactly SUMMARY_THRESHOLD messages should trigger summarization."""
        messages = [
            {"role": "user", "content": f"Message {i}"}
            for i in range(SUMMARY_THRESHOLD)
        ]

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.content = "Summary at threshold"
        mock_client.ainvoke = AsyncMock(return_value=mock_response)

        result = await manage_message_history(messages, client=mock_client)

        # Should have summarized — ainvoke was called
        mock_client.ainvoke.assert_called_once()
        # First message is summary, no recent remainder (all 40 summarized)
        assert len(result) == 1
        assert "Prior conversation summary" in result[0]["content"][0]["text"]

    @pytest.mark.asyncio
    async def test_over_threshold_triggers_summarization(self) -> None:
        """Messages well over threshold should be summarized."""
        messages = [
            {"role": "user", "content": f"Message {i}"}
            for i in range(MAX_MESSAGES + 5)
        ]

        # Mock the ChatAnthropic client (ainvoke returns AIMessage-like)
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.content = "Summary: discussed issues #42 and #43"
        mock_client.ainvoke = AsyncMock(return_value=mock_response)

        result = await manage_message_history(messages, client=mock_client)

        # Should have summary + recent messages
        assert len(result) == 1 + (len(messages) - SUMMARY_THRESHOLD)
        # First message should be the summary
        first_content = result[0]["content"]
        assert isinstance(first_content, list)
        assert "Prior conversation summary" in first_content[0]["text"]
        assert "Summary: discussed" in first_content[0]["text"]

    @pytest.mark.asyncio
    async def test_summarization_calls_llm(self) -> None:
        """Summarization should call the ChatAnthropic ainvoke."""
        messages = [
            {"role": "user", "content": f"Message {i}"}
            for i in range(SUMMARY_THRESHOLD + 1)
        ]

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.content = "Summary text"
        mock_client.ainvoke = AsyncMock(return_value=mock_response)

        await manage_message_history(messages, client=mock_client)

        mock_client.ainvoke.assert_called_once()

    @pytest.mark.asyncio
    async def test_recent_messages_preserved(self) -> None:
        """Recent messages (after threshold) should be kept verbatim."""
        messages = [
            {"role": "user", "content": f"Message {i}"}
            for i in range(MAX_MESSAGES + 10)
        ]

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.content = "Summary"
        mock_client.ainvoke = AsyncMock(return_value=mock_response)

        result = await manage_message_history(messages, client=mock_client)

        # Recent messages should be the last (total - SUMMARY_THRESHOLD)
        recent_count = len(messages) - SUMMARY_THRESHOLD
        recent_messages = result[1:]  # Skip summary
        assert len(recent_messages) == recent_count
        for i, msg in enumerate(recent_messages):
            expected_idx = SUMMARY_THRESHOLD + i
            assert msg["content"] == f"Message {expected_idx}"


class TestMemoryConstants:
    """Verify memory configuration."""

    def test_max_messages_is_50(self) -> None:
        assert MAX_MESSAGES == 50

    def test_summary_threshold_is_40(self) -> None:
        assert SUMMARY_THRESHOLD == 40

    def test_threshold_less_than_max(self) -> None:
        assert SUMMARY_THRESHOLD < MAX_MESSAGES
