"""Shared LLM utilities — ChatAnthropic factory, message conversion, cost tracking.

All agent nodes use ChatAnthropic from langchain-anthropic for LLM calls,
ensuring LangSmith auto-tracing of prompts, completions, tool calls, and
token counts. This module provides shared helpers to avoid duplication.

Spec ref: RFC Phase 2 §4.1, §6 Implementation Mandate
"""

import logging
from datetime import datetime, timezone
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.outputs import LLMResult

logger = logging.getLogger(__name__)

# Default model for all agent reasoning
DEFAULT_MODEL = "claude-sonnet-4-20250514"
DEFAULT_MAX_TOKENS = 4096


class CostTrackingCallback(BaseCallbackHandler):
    """LangChain callback that captures token usage from every LLM call.

    Registered once per node invocation. After the agentic loop completes,
    the node reads ``self.entries`` and writes them to ``state.cost_tracker``.

    This centralises extraction logic so future agents get cost tracking
    automatically — impossible to forget when adding new nodes (RFC §13.4.1,
    open question #3).
    """

    def __init__(
        self,
        agent: str,
        cost_config: dict | None = None,
    ) -> None:
        super().__init__()
        self.agent = agent
        self.cost_config = cost_config or {}
        self.entries: list[dict] = []

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """Extract token usage from the ChatAnthropic response."""
        llm_output = response.llm_output or {}
        usage = llm_output.get("usage", {})
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)

        # If llm_output doesn't have usage, try token_usage key
        if not input_tokens and not output_tokens:
            token_usage = llm_output.get("token_usage", {})
            input_tokens = token_usage.get("prompt_tokens", 0)
            output_tokens = token_usage.get("completion_tokens", 0)

        input_rate = self.cost_config.get(
            "claude_sonnet_input_per_mtok", 3.0
        )
        output_rate = self.cost_config.get(
            "claude_sonnet_output_per_mtok", 15.0
        )
        cost_usd = (input_tokens / 1_000_000 * input_rate) + (
            output_tokens / 1_000_000 * output_rate
        )

        self.entries.append(
            {
                "agent": self.agent,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": round(cost_usd, 6),
                "source": "langsmith",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )


def create_llm(
    max_tokens: int = DEFAULT_MAX_TOKENS,
    model: str = DEFAULT_MODEL,
    callbacks: list[BaseCallbackHandler] | None = None,
) -> ChatAnthropic:
    """Create a ChatAnthropic instance with standard configuration.

    Uses ANTHROPIC_API_KEY from environment (handled by langchain-anthropic).
    LangSmith auto-tracing is enabled when LANGCHAIN_TRACING_V2=true.

    Args:
        max_tokens: Maximum tokens per LLM call.
        model: Claude model ID.
        callbacks: Optional LangChain callbacks (e.g., CostTrackingCallback).
    """
    return ChatAnthropic(
        model=model, max_tokens=max_tokens, callbacks=callbacks or []
    )


def dicts_to_langchain(messages: list[dict]) -> list[BaseMessage]:
    """Convert state message dicts to LangChain message objects.

    Handles both the new serializable format and legacy Anthropic SDK
    content block objects (from pre-migration checkpoints).
    """
    result: list[BaseMessage] = []
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")

        if role == "user":
            if isinstance(content, str):
                result.append(HumanMessage(content=content))
            elif isinstance(content, list):
                # Could be tool results or multi-part content
                text_parts = []
                for item in content:
                    if not isinstance(item, dict):
                        continue
                    if item.get("type") == "tool_result":
                        result.append(
                            ToolMessage(
                                content=item.get("content", ""),
                                tool_call_id=item.get("tool_use_id", ""),
                            )
                        )
                    elif item.get("type") == "text":
                        text_parts.append(item["text"])
                if text_parts:
                    result.append(HumanMessage(content="\n".join(text_parts)))

        elif role == "assistant":
            tool_calls = msg.get("tool_calls", [])
            if isinstance(content, str):
                result.append(
                    AIMessage(content=content, tool_calls=tool_calls)
                )
            elif isinstance(content, list):
                # Legacy format: list of Anthropic content blocks
                text = ""
                extracted_calls = []
                for block in content:
                    if hasattr(block, "type"):
                        # Anthropic SDK content block objects
                        if block.type == "text":
                            text += block.text
                        elif block.type == "tool_use":
                            extracted_calls.append(
                                {
                                    "name": block.name,
                                    "args": block.input,
                                    "id": block.id,
                                }
                            )
                    elif isinstance(block, dict):
                        if block.get("type") == "text":
                            text += block.get("text", "")
                        elif block.get("type") == "tool_use":
                            extracted_calls.append(
                                {
                                    "name": block["name"],
                                    "args": block.get("input", {}),
                                    "id": block.get("id", ""),
                                }
                            )
                result.append(
                    AIMessage(
                        content=text,
                        tool_calls=tool_calls or extracted_calls,
                    )
                )

        elif role == "tool":
            result.append(
                ToolMessage(
                    content=content,
                    tool_call_id=msg.get("tool_call_id", ""),
                )
            )

    return result


def langchain_to_dicts(messages: list[BaseMessage]) -> list[dict]:
    """Convert LangChain messages to JSON-serializable dicts for state storage."""
    result: list[dict] = []
    for msg in messages:
        if isinstance(msg, HumanMessage):
            result.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage):
            d: dict[str, Any] = {
                "role": "assistant",
                "content": msg.content,
            }
            if msg.tool_calls:
                d["tool_calls"] = [
                    {
                        "name": tc["name"],
                        "args": tc["args"],
                        "id": tc["id"],
                    }
                    for tc in msg.tool_calls
                ]
            result.append(d)
        elif isinstance(msg, ToolMessage):
            result.append(
                {
                    "role": "tool",
                    "content": msg.content,
                    "tool_call_id": msg.tool_call_id,
                }
            )
        elif isinstance(msg, SystemMessage):
            pass  # System messages handled separately, not stored in state
    return result


def extract_token_usage(
    response: AIMessage,
    agent: str,
    cost_config: dict | None = None,
) -> dict:
    """Extract token usage from a ChatAnthropic response.

    Args:
        response: AIMessage from ChatAnthropic.ainvoke().
        agent: Agent name for tracking (e.g., "scrum_master").
        cost_config: Cost control config with pricing rates.

    Returns:
        Token usage dict for cost_tracker accumulation.
    """
    usage = response.usage_metadata or {}
    input_tokens = usage.get("input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)

    # Calculate cost from config pricing
    input_rate = 3.0  # default $/M input tokens
    output_rate = 15.0  # default $/M output tokens
    if cost_config:
        input_rate = cost_config.get("claude_sonnet_input_per_mtok", 3.0)
        output_rate = cost_config.get("claude_sonnet_output_per_mtok", 15.0)

    cost_usd = (input_tokens / 1_000_000 * input_rate) + (
        output_tokens / 1_000_000 * output_rate
    )

    return {
        "agent": agent,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": round(cost_usd, 6),
        "source": "langsmith",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def parse_claude_code_usage(
    log_output: str,
    cost_config: dict | None = None,
) -> dict | None:
    """Parse usage.json from Claude Code Runner job output.

    The runner writes a line like:
        USAGE_JSON:{"input_tokens":N,"output_tokens":N,"total_cost_usd":N.NN}

    Returns a cost entry dict with source="claude_code_job", or None if
    usage data is not found in the log output.
    """
    import json as _json
    import re

    # Look for USAGE_JSON:{...} line in log output
    match = re.search(r"USAGE_JSON:(\{[^}]+\})", log_output)
    if not match:
        # Fallback: look for a bare JSON object with expected keys
        match = re.search(
            r'\{"input_tokens":\s*\d+.*?"output_tokens":\s*\d+.*?\}',
            log_output,
        )
        if not match:
            logger.warning(
                "No usage.json found in Claude Code Runner output"
            )
            return None

    try:
        usage = _json.loads(match.group(1) if match.lastindex else match.group(0))
    except _json.JSONDecodeError:
        logger.warning(f"Failed to parse usage JSON: {match.group(0)[:200]}")
        return None

    input_tokens = usage.get("input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)

    # Use cost from runner if provided, otherwise calculate
    cost_usd = usage.get("total_cost_usd")
    if cost_usd is None:
        input_rate = 3.0
        output_rate = 15.0
        if cost_config:
            input_rate = cost_config.get("claude_sonnet_input_per_mtok", 3.0)
            output_rate = cost_config.get(
                "claude_sonnet_output_per_mtok", 15.0
            )
        cost_usd = (input_tokens / 1_000_000 * input_rate) + (
            output_tokens / 1_000_000 * output_rate
        )

    return {
        "agent": "claude_code",
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": round(float(cost_usd), 6),
        "source": "claude_code_job",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def accumulate_cost(
    cost_tracker: dict, usage_entry: dict
) -> dict:
    """Add a token usage entry to the cost tracker.

    Maintains both individual entries and running totals.
    """
    if not cost_tracker:
        cost_tracker = {
            "entries": [],
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "total_cost_usd": 0.0,
        }

    entries = cost_tracker.get("entries", [])
    entries.append(usage_entry)

    return {
        "entries": entries,
        "total_input_tokens": cost_tracker.get("total_input_tokens", 0)
        + usage_entry.get("input_tokens", 0),
        "total_output_tokens": cost_tracker.get("total_output_tokens", 0)
        + usage_entry.get("output_tokens", 0),
        "total_cost_usd": round(
            cost_tracker.get("total_cost_usd", 0.0)
            + usage_entry.get("cost_usd", 0.0),
            6,
        ),
    }
