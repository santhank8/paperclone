"""Conversation history management.

Claude handles reasoning; we handle size.
Tier 2 (Story Memory): sliding window with LLM-generated summaries.

Uses ChatAnthropic for summarization to maintain LangSmith tracing consistency.
Spec ref: Phase 2 RFC — Track H, §10.3 Memory Management
"""

import logging
from typing import Optional

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from .llm import create_llm

logger = logging.getLogger(__name__)

MAX_MESSAGES = 50
SUMMARY_THRESHOLD = 40  # When we hit 40 messages, summarize oldest 30


async def manage_message_history(
    messages: list,
    client: Optional[ChatAnthropic] = None,
) -> list:
    """Keep message history within token budget.

    Strategy (RFC §10.3):
    - Under SUMMARY_THRESHOLD (40): return as-is
    - At or above SUMMARY_THRESHOLD: summarize oldest messages into a
      single context message, keeping recent messages verbatim.
      Result is always ≤ MAX_MESSAGES (50).
    """
    if len(messages) < SUMMARY_THRESHOLD:
        return messages

    if client is None:
        client = create_llm(max_tokens=500)

    # Split: old messages to summarize, recent to keep
    old_messages = messages[:SUMMARY_THRESHOLD]
    recent_messages = messages[SUMMARY_THRESHOLD:]

    logger.info(
        f"Message history at {len(messages)} — summarizing "
        f"oldest {len(old_messages)} messages"
    )

    # Claude summarizes — we don't template it
    summary_response = await client.ainvoke(
        [
            SystemMessage(
                content=(
                    "Summarize this conversation history into a concise set of key facts "
                    "and decisions. Preserve: issue numbers, PR numbers, branch names, "
                    "tool call results, human decisions, error details, and any "
                    "commitments made. Omit greetings and conversational filler."
                ),
            ),
            HumanMessage(
                content=(
                    "Summarize this agent conversation history:\n\n"
                    f"{_serialize_messages(old_messages)}"
                ),
            ),
        ]
    )

    summary_text = summary_response.content

    # Replace old messages with a single context message
    summary_message = {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": f"[Prior conversation summary]\n{summary_text}",
            }
        ],
    }

    logger.info(
        f"Summarized {len(old_messages)} messages into "
        f"{len(summary_text)} chars"
    )
    return [summary_message] + recent_messages


def _serialize_messages(messages: list) -> str:
    """Convert message list to readable text for summarization."""
    lines = []
    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        if isinstance(content, list):
            # Tool results or multi-part content
            parts = []
            for part in content:
                if isinstance(part, dict):
                    if part.get("type") == "text":
                        parts.append(part["text"])
                    elif part.get("type") == "tool_result":
                        parts.append(
                            f"[Tool result: {part.get('content', '')[:200]}]"
                        )
                    elif part.get("type") == "tool_use":
                        parts.append(f"[Tool call: {part.get('name', '?')}]")
                else:
                    parts.append(str(part)[:200])
            content = " | ".join(parts)
        elif hasattr(content, "text"):
            content = content.text
        # Handle tool messages (new format)
        tool_calls = msg.get("tool_calls", [])
        if tool_calls:
            tc_names = ", ".join(tc.get("name", "?") for tc in tool_calls)
            lines.append(f"{role}: {str(content)[:300]} [Tools: {tc_names}]")
        else:
            lines.append(f"{role}: {str(content)[:300]}")
    return "\n".join(lines)
