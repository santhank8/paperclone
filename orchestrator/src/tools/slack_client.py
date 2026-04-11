"""Slack integration — outbound via webhook, inbound via Socket Mode.

Spec ref: AgenticSquad_Functional_Spec v2.8 RC §8.2, §8.5
WF4: Intervention commands (TRA-56/57/58), escalation formatting (TRA-62)
"""

from __future__ import annotations

import logging
import os
from enum import Enum
from typing import TYPE_CHECKING, Callable, Optional

from slack_sdk.webhook import WebhookClient
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

if TYPE_CHECKING:
    from ..state import SDLCState

logger = logging.getLogger(__name__)


# ── TRA-62: Structured escalation categories ──


class ErrorCategory(str, Enum):
    """Escalation error categories (TRA-62)."""

    LLM_FAILURE = "LLM_FAILURE"
    API_FAILURE = "API_FAILURE"
    TIMEOUT = "TIMEOUT"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    UNKNOWN = "UNKNOWN"


def classify_error(error: Exception) -> ErrorCategory:
    """Classify an exception into an escalation category."""
    name = type(error).__name__.lower()
    msg = str(error).lower()

    if "timeout" in name or "timeout" in msg or "timed out" in msg:
        return ErrorCategory.TIMEOUT
    if "permission" in msg or "forbidden" in msg or "403" in msg:
        return ErrorCategory.PERMISSION_DENIED
    if "401" in msg or "auth" in msg:
        return ErrorCategory.PERMISSION_DENIED
    if any(k in name for k in ("anthropic", "llm", "model", "chat")):
        return ErrorCategory.LLM_FAILURE
    if any(k in name for k in ("http", "url", "api", "connection")):
        return ErrorCategory.API_FAILURE
    if any(k in msg for k in ("rate limit", "429", "500", "502", "503")):
        return ErrorCategory.API_FAILURE

    return ErrorCategory.UNKNOWN


def format_escalation(
    *,
    story_id: Optional[str] = None,
    story_title: str = "",
    node_name: str = "",
    error_category: ErrorCategory = ErrorCategory.UNKNOWN,
    last_action: str = "",
    suggested_fix: str = "",
    run_url: str = "",
) -> str:
    """Format a structured escalation message for Slack (TRA-62).

    No raw tracebacks — full traceback goes to container logs only.
    """
    lines = [":rotating_light: *Escalation*"]

    if story_id:
        title_part = f" — {story_title}" if story_title else ""
        lines.append(f"*Story:* {story_id}{title_part}")

    if node_name:
        lines.append(f"*Failing node:* `{node_name}`")

    lines.append(f"*Error category:* `{error_category.value}`")

    if last_action:
        lines.append(f"*Last action:* {last_action}")

    if suggested_fix:
        lines.append(f"*Suggested fix:* {suggested_fix}")

    if run_url:
        lines.append(f"*Actions run:* <{run_url}|View logs>")

    return "\n".join(lines)


# ── Intervention command parsing (TRA-56/57/58) ──


def parse_intervention_command(text: str) -> Optional[tuple[str, dict]]:
    """Parse a Slack message for intervention commands.

    Returns (command_name, args) or None if not an intervention command.
    Supported commands: /pause, /resume, /cancel, /status
    """
    text = text.strip()

    # Exact match commands (case-insensitive)
    lower = text.lower()

    if lower in ("/pause", "pause"):
        return ("pause", {})

    if lower in ("/resume", "resume"):
        return ("resume", {})

    # Only /status (with slash) triggers intervention status.
    # Bare "status" is handled by the existing graph state query in main.py.
    if lower == "/status":
        return ("status", {})

    if lower.startswith(("/cancel", "cancel")):
        return ("cancel", {})

    return None


class SlackClient:
    """Slack outbound (webhook) + inbound (Socket Mode) wrapper."""

    def __init__(
        self,
        webhook_url: str,
        app_token: Optional[str] = None,
    ) -> None:
        self._webhook = WebhookClient(url=webhook_url)
        self._app_token = app_token

    @classmethod
    def from_state(cls, state: SDLCState) -> SlackClient:
        """Create SlackClient from environment variables."""
        webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")
        app_token = os.environ.get("SLACK_APP_TOKEN", "")
        return cls(webhook_url=webhook_url, app_token=app_token)

    async def post(self, text: str, thread_ts: Optional[str] = None) -> None:
        """Post a message via incoming webhook."""
        try:
            response = self._webhook.send(text=text)
            if response.status_code != 200:
                logger.error(
                    f"Slack webhook failed: {response.status_code} "
                    f"{response.body}"
                )
        except Exception:
            logger.exception("Failed to post Slack message")

    def create_socket_mode_handler(
        self, message_callback: Callable[[str], None]
    ) -> SocketModeHandler:
        """Create a Socket Mode handler for inbound messages.

        Args:
            message_callback: Called with the message text when a user
                posts in the channel.

        Returns:
            A SocketModeHandler ready to be started with .start().
        """
        if not self._app_token:
            raise ValueError(
                "SLACK_APP_TOKEN required for Socket Mode listener"
            )

        bot_token = os.environ.get("SLACK_BOT_TOKEN", "")
        if not bot_token:
            raise ValueError(
                "SLACK_BOT_TOKEN required for Socket Mode listener"
            )

        app = App(token=bot_token)

        @app.message("")
        def handle_message(message, say):
            # BUG-4 fix: ignore the bot's own messages to prevent infinite loop.
            # Bot messages carry bot_id or subtype "bot_message".
            if message.get("bot_id") or message.get("subtype"):
                return

            text = message.get("text", "").strip()
            if not text:
                return

            logger.info(f"Slack message received: {text}")
            message_callback(text)

        return SocketModeHandler(app, self._app_token)
