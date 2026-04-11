"""Test shared LLM utilities — message conversion, cost tracking.

Spec ref: Phase 2 RFC — §4.1, §6 Implementation Mandate, §13.4.1
"""

import pytest
from unittest.mock import MagicMock

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.outputs import LLMResult

from src.llm import (
    CostTrackingCallback,
    accumulate_cost,
    dicts_to_langchain,
    extract_token_usage,
    langchain_to_dicts,
    parse_claude_code_usage,
)


class TestDictsToLangchain:
    """Test conversion from state dict format to LangChain messages."""

    def test_user_text_message(self) -> None:
        msgs = [{"role": "user", "content": "hello"}]
        result = dicts_to_langchain(msgs)
        assert len(result) == 1
        assert isinstance(result[0], HumanMessage)
        assert result[0].content == "hello"

    def test_assistant_text_message(self) -> None:
        msgs = [{"role": "assistant", "content": "hi there"}]
        result = dicts_to_langchain(msgs)
        assert len(result) == 1
        assert isinstance(result[0], AIMessage)
        assert result[0].content == "hi there"

    def test_assistant_with_tool_calls(self) -> None:
        msgs = [
            {
                "role": "assistant",
                "content": "Let me check",
                "tool_calls": [
                    {
                        "name": "get_open_issues",
                        "args": {"label_filter": "phase/0"},
                        "id": "tc_1",
                    }
                ],
            }
        ]
        result = dicts_to_langchain(msgs)
        assert len(result) == 1
        assert isinstance(result[0], AIMessage)
        assert result[0].content == "Let me check"
        assert len(result[0].tool_calls) == 1
        assert result[0].tool_calls[0]["name"] == "get_open_issues"

    def test_tool_message(self) -> None:
        msgs = [
            {
                "role": "tool",
                "content": "Found 3 issues",
                "tool_call_id": "tc_1",
            }
        ]
        result = dicts_to_langchain(msgs)
        assert len(result) == 1
        assert isinstance(result[0], ToolMessage)
        assert result[0].content == "Found 3 issues"
        assert result[0].tool_call_id == "tc_1"

    def test_legacy_tool_result_format(self) -> None:
        """Legacy Anthropic format: tool results as user content blocks."""
        msgs = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": "tc_1",
                        "content": "Issue #42 details",
                    }
                ],
            }
        ]
        result = dicts_to_langchain(msgs)
        assert len(result) == 1
        assert isinstance(result[0], ToolMessage)
        assert result[0].content == "Issue #42 details"

    def test_legacy_text_block_format(self) -> None:
        """Legacy format: text blocks in user content."""
        msgs = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Summary of conversation"},
                ],
            }
        ]
        result = dicts_to_langchain(msgs)
        assert len(result) == 1
        assert isinstance(result[0], HumanMessage)
        assert result[0].content == "Summary of conversation"

    def test_empty_messages(self) -> None:
        result = dicts_to_langchain([])
        assert result == []

    def test_mixed_message_sequence(self) -> None:
        msgs = [
            {"role": "user", "content": "What issues?"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {"name": "get_open_issues", "args": {}, "id": "tc_1"},
                ],
            },
            {"role": "tool", "content": "[{issue: 42}]", "tool_call_id": "tc_1"},
            {"role": "assistant", "content": "Found issue #42"},
        ]
        result = dicts_to_langchain(msgs)
        assert len(result) == 4
        assert isinstance(result[0], HumanMessage)
        assert isinstance(result[1], AIMessage)
        assert isinstance(result[2], ToolMessage)
        assert isinstance(result[3], AIMessage)


class TestLangchainToDicts:
    """Test conversion from LangChain messages to state dicts."""

    def test_human_message(self) -> None:
        msgs = [HumanMessage(content="hello")]
        result = langchain_to_dicts(msgs)
        assert len(result) == 1
        assert result[0] == {"role": "user", "content": "hello"}

    def test_ai_message_text_only(self) -> None:
        msgs = [AIMessage(content="hi there")]
        result = langchain_to_dicts(msgs)
        assert len(result) == 1
        assert result[0] == {"role": "assistant", "content": "hi there"}

    def test_ai_message_with_tool_calls(self) -> None:
        msgs = [
            AIMessage(
                content="Checking",
                tool_calls=[
                    {"name": "get_issues", "args": {}, "id": "tc_1"},
                ],
            )
        ]
        result = langchain_to_dicts(msgs)
        assert len(result) == 1
        assert result[0]["role"] == "assistant"
        assert result[0]["content"] == "Checking"
        assert len(result[0]["tool_calls"]) == 1
        assert result[0]["tool_calls"][0]["name"] == "get_issues"

    def test_tool_message(self) -> None:
        msgs = [ToolMessage(content="result", tool_call_id="tc_1")]
        result = langchain_to_dicts(msgs)
        assert len(result) == 1
        assert result[0] == {
            "role": "tool",
            "content": "result",
            "tool_call_id": "tc_1",
        }

    def test_system_messages_skipped(self) -> None:
        msgs = [
            SystemMessage(content="You are a bot"),
            HumanMessage(content="hi"),
        ]
        result = langchain_to_dicts(msgs)
        assert len(result) == 1
        assert result[0]["role"] == "user"

    def test_roundtrip_user_message(self) -> None:
        original = [{"role": "user", "content": "hello"}]
        lc = dicts_to_langchain(original)
        result = langchain_to_dicts(lc)
        assert result == original

    def test_roundtrip_tool_message(self) -> None:
        original = [
            {"role": "tool", "content": "result", "tool_call_id": "tc_1"},
        ]
        lc = dicts_to_langchain(original)
        result = langchain_to_dicts(lc)
        assert result == original


class TestExtractTokenUsage:
    """Test token usage extraction from ChatAnthropic responses."""

    def test_extract_with_usage_metadata(self) -> None:
        response = MagicMock(spec=AIMessage)
        response.usage_metadata = {
            "input_tokens": 1000,
            "output_tokens": 500,
            "total_tokens": 1500,
        }
        result = extract_token_usage(response, "scrum_master")
        assert result["agent"] == "scrum_master"
        assert result["input_tokens"] == 1000
        assert result["output_tokens"] == 500
        assert result["source"] == "langsmith"
        assert result["cost_usd"] > 0

    def test_extract_with_custom_pricing(self) -> None:
        response = MagicMock(spec=AIMessage)
        response.usage_metadata = {
            "input_tokens": 1_000_000,
            "output_tokens": 1_000_000,
        }
        cost_config = {
            "claude_sonnet_input_per_mtok": 3.0,
            "claude_sonnet_output_per_mtok": 15.0,
        }
        result = extract_token_usage(
            response, "test_lead", cost_config
        )
        assert result["cost_usd"] == 18.0  # 3.0 + 15.0

    def test_extract_with_no_usage(self) -> None:
        response = MagicMock(spec=AIMessage)
        response.usage_metadata = None
        result = extract_token_usage(response, "code_operator")
        assert result["input_tokens"] == 0
        assert result["output_tokens"] == 0
        assert result["cost_usd"] == 0.0

    def test_extract_has_timestamp(self) -> None:
        response = MagicMock(spec=AIMessage)
        response.usage_metadata = {"input_tokens": 10, "output_tokens": 5}
        result = extract_token_usage(response, "scrum_master")
        assert "timestamp" in result
        assert "T" in result["timestamp"]  # ISO format


class TestAccumulateCost:
    """Test cost accumulation across LLM calls."""

    def test_first_entry_creates_tracker(self) -> None:
        entry = {
            "agent": "scrum_master",
            "input_tokens": 100,
            "output_tokens": 50,
            "cost_usd": 0.001,
            "source": "langsmith",
            "timestamp": "2026-01-01T00:00:00Z",
        }
        result = accumulate_cost({}, entry)
        assert result["total_input_tokens"] == 100
        assert result["total_output_tokens"] == 50
        assert result["total_cost_usd"] == 0.001
        assert len(result["entries"]) == 1

    def test_accumulates_multiple_entries(self) -> None:
        entry1 = {
            "input_tokens": 100,
            "output_tokens": 50,
            "cost_usd": 0.001,
        }
        entry2 = {
            "input_tokens": 200,
            "output_tokens": 100,
            "cost_usd": 0.002,
        }
        tracker = accumulate_cost({}, entry1)
        tracker = accumulate_cost(tracker, entry2)
        assert tracker["total_input_tokens"] == 300
        assert tracker["total_output_tokens"] == 150
        assert tracker["total_cost_usd"] == 0.003
        assert len(tracker["entries"]) == 2

    def test_preserves_existing_entries(self) -> None:
        existing = {
            "entries": [{"agent": "old", "cost_usd": 0.01}],
            "total_input_tokens": 500,
            "total_output_tokens": 200,
            "total_cost_usd": 0.01,
        }
        new_entry = {
            "input_tokens": 100,
            "output_tokens": 50,
            "cost_usd": 0.001,
        }
        result = accumulate_cost(existing, new_entry)
        assert len(result["entries"]) == 2
        assert result["total_input_tokens"] == 600
        assert result["total_cost_usd"] == 0.011


class TestCostTrackingCallback:
    """Test CostTrackingCallback — centralized LLM cost extraction."""

    def test_on_llm_end_captures_usage(self) -> None:
        cb = CostTrackingCallback("scrum_master")
        llm_result = MagicMock(spec=LLMResult)
        llm_result.llm_output = {
            "usage": {"input_tokens": 1000, "output_tokens": 500},
        }
        cb.on_llm_end(llm_result)
        assert len(cb.entries) == 1
        assert cb.entries[0]["agent"] == "scrum_master"
        assert cb.entries[0]["input_tokens"] == 1000
        assert cb.entries[0]["output_tokens"] == 500
        assert cb.entries[0]["source"] == "langsmith"
        assert cb.entries[0]["cost_usd"] > 0

    def test_on_llm_end_custom_pricing(self) -> None:
        cost_config = {
            "claude_sonnet_input_per_mtok": 3.0,
            "claude_sonnet_output_per_mtok": 15.0,
        }
        cb = CostTrackingCallback("test_lead", cost_config)
        llm_result = MagicMock(spec=LLMResult)
        llm_result.llm_output = {
            "usage": {
                "input_tokens": 1_000_000,
                "output_tokens": 1_000_000,
            },
        }
        cb.on_llm_end(llm_result)
        assert cb.entries[0]["cost_usd"] == 18.0

    def test_on_llm_end_fallback_token_usage_key(self) -> None:
        """Falls back to token_usage key if usage key is empty."""
        cb = CostTrackingCallback("code_operator")
        llm_result = MagicMock(spec=LLMResult)
        llm_result.llm_output = {
            "token_usage": {
                "prompt_tokens": 200,
                "completion_tokens": 100,
            },
        }
        cb.on_llm_end(llm_result)
        assert cb.entries[0]["input_tokens"] == 200
        assert cb.entries[0]["output_tokens"] == 100

    def test_on_llm_end_no_output(self) -> None:
        cb = CostTrackingCallback("scrum_master")
        llm_result = MagicMock(spec=LLMResult)
        llm_result.llm_output = None
        cb.on_llm_end(llm_result)
        assert len(cb.entries) == 1
        assert cb.entries[0]["input_tokens"] == 0
        assert cb.entries[0]["output_tokens"] == 0
        assert cb.entries[0]["cost_usd"] == 0.0

    def test_accumulates_multiple_calls(self) -> None:
        cb = CostTrackingCallback("scrum_master")
        for i in range(3):
            llm_result = MagicMock(spec=LLMResult)
            llm_result.llm_output = {
                "usage": {
                    "input_tokens": 100 * (i + 1),
                    "output_tokens": 50 * (i + 1),
                },
            }
            cb.on_llm_end(llm_result)
        assert len(cb.entries) == 3
        assert cb.entries[0]["input_tokens"] == 100
        assert cb.entries[2]["input_tokens"] == 300

    def test_has_timestamp(self) -> None:
        cb = CostTrackingCallback("scrum_master")
        llm_result = MagicMock(spec=LLMResult)
        llm_result.llm_output = {
            "usage": {"input_tokens": 10, "output_tokens": 5},
        }
        cb.on_llm_end(llm_result)
        assert "timestamp" in cb.entries[0]
        assert "T" in cb.entries[0]["timestamp"]


class TestParseClaudeCodeUsage:
    """Test Claude Code Runner usage.json parsing (RFC §13.4.1)."""

    def test_parse_usage_json_line(self) -> None:
        log = (
            "Starting job...\n"
            'USAGE_JSON:{"input_tokens":50000,"output_tokens":10000,'
            '"total_cost_usd":0.30}\n'
            "Job complete."
        )
        result = parse_claude_code_usage(log)
        assert result is not None
        assert result["agent"] == "claude_code"
        assert result["input_tokens"] == 50000
        assert result["output_tokens"] == 10000
        assert result["cost_usd"] == 0.3
        assert result["source"] == "claude_code_job"

    def test_parse_bare_json_fallback(self) -> None:
        log = (
            'Some output\n{"input_tokens": 1000, "output_tokens": 500}\nDone'
        )
        result = parse_claude_code_usage(log)
        assert result is not None
        assert result["input_tokens"] == 1000
        assert result["output_tokens"] == 500
        assert result["source"] == "claude_code_job"

    def test_parse_no_usage_returns_none(self) -> None:
        log = "Job started\nJob completed successfully\n"
        result = parse_claude_code_usage(log)
        assert result is None

    def test_parse_calculates_cost_when_not_provided(self) -> None:
        log = 'USAGE_JSON:{"input_tokens":1000000,"output_tokens":1000000}'
        cost_config = {
            "claude_sonnet_input_per_mtok": 3.0,
            "claude_sonnet_output_per_mtok": 15.0,
        }
        result = parse_claude_code_usage(log, cost_config)
        assert result is not None
        assert result["cost_usd"] == 18.0

    def test_parse_uses_runner_cost_when_provided(self) -> None:
        log = (
            'USAGE_JSON:{"input_tokens":1000,"output_tokens":500,'
            '"total_cost_usd":0.123}'
        )
        result = parse_claude_code_usage(log)
        assert result is not None
        assert result["cost_usd"] == 0.123

    def test_parse_has_timestamp(self) -> None:
        log = 'USAGE_JSON:{"input_tokens":10,"output_tokens":5,"total_cost_usd":0.01}'
        result = parse_claude_code_usage(log)
        assert result is not None
        assert "timestamp" in result
        assert "T" in result["timestamp"]
