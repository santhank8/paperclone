"""Unit tests for SlackClient — bot message filtering (BUG-4 fix).

Spec ref: Phase 2 ACTION_SPEC — BUG-4

Tests mock the Bolt App to avoid live Slack API calls, then exercise the
message handler closure that create_socket_mode_handler registers.
"""

from unittest.mock import MagicMock, patch

import pytest

from src.tools.slack_client import SlackClient


class TestBotMessageFiltering:
    """Verify that the Socket Mode handler ignores bot messages."""

    @pytest.fixture
    def callback(self):
        return MagicMock()

    @pytest.fixture
    def handler_fn(self, callback):
        """Capture the message handler closure registered by create_socket_mode_handler.

        Mocks the Bolt App and SocketModeHandler so no real Slack calls are made.
        The @app.message("") decorator registers a listener — we intercept it.
        """
        captured_handler = {}

        def fake_message_decorator(pattern):
            """Mimic @app.message("") to capture the handler function."""
            def decorator(fn):
                captured_handler["fn"] = fn
                return fn
            return decorator

        mock_app = MagicMock()
        mock_app.message = fake_message_decorator

        with patch("src.tools.slack_client.App", return_value=mock_app), \
             patch("src.tools.slack_client.SocketModeHandler"), \
             patch.dict("os.environ", {"SLACK_BOT_TOKEN": "xoxb-test"}):
            client = SlackClient(
                webhook_url="https://hooks.slack.com/test",
                app_token="xapp-test-token",
            )
            client.create_socket_mode_handler(callback)

        assert "fn" in captured_handler, "Handler was not registered"
        return captured_handler["fn"]

    def test_ignores_bot_id_messages(self, handler_fn, callback) -> None:
        """Messages with bot_id should be silently dropped."""
        message = {
            "text": "No active story. Available commands:...",
            "bot_id": "B12345",
        }
        handler_fn(message, say=MagicMock())
        callback.assert_not_called()

    def test_ignores_bot_message_subtype(self, handler_fn, callback) -> None:
        """Messages with subtype 'bot_message' should be dropped."""
        message = {
            "text": "Hello",
            "subtype": "bot_message",
        }
        handler_fn(message, say=MagicMock())
        callback.assert_not_called()

    def test_ignores_message_changed_subtype(self, handler_fn, callback) -> None:
        """Messages with subtype 'message_changed' should be dropped."""
        message = {
            "text": "edited text",
            "subtype": "message_changed",
        }
        handler_fn(message, say=MagicMock())
        callback.assert_not_called()

    def test_ignores_message_deleted_subtype(self, handler_fn, callback) -> None:
        """Messages with subtype 'message_deleted' should be dropped."""
        message = {
            "text": "",
            "subtype": "message_deleted",
        }
        handler_fn(message, say=MagicMock())
        callback.assert_not_called()

    def test_ignores_empty_text(self, handler_fn, callback) -> None:
        """Messages with empty text should be silently dropped."""
        message = {"text": ""}
        handler_fn(message, say=MagicMock())
        callback.assert_not_called()

    def test_ignores_missing_text_field(self, handler_fn, callback) -> None:
        """Messages without a text field should be silently dropped."""
        message = {"user": "U12345"}
        handler_fn(message, say=MagicMock())
        callback.assert_not_called()

    def test_ignores_whitespace_only_text(self, handler_fn, callback) -> None:
        """Messages with only whitespace should be dropped."""
        message = {"text": "   "}
        handler_fn(message, say=MagicMock())
        callback.assert_not_called()

    def test_passes_human_messages(self, handler_fn, callback) -> None:
        """Human messages (no bot_id, no subtype) should reach the callback."""
        message = {
            "text": "pick up issue #42",
            "user": "U12345",
        }
        handler_fn(message, say=MagicMock())
        callback.assert_called_once_with("pick up issue #42")

    def test_preserves_original_casing(self, handler_fn, callback) -> None:
        """Message text should preserve original casing (not lowered)."""
        message = {
            "text": "Pick Up Issue #42",
            "user": "U12345",
        }
        handler_fn(message, say=MagicMock())
        callback.assert_called_once_with("Pick Up Issue #42")

    def test_strips_whitespace(self, handler_fn, callback) -> None:
        """Message text should be stripped of leading/trailing whitespace."""
        message = {
            "text": "  hello world  ",
            "user": "U12345",
        }
        handler_fn(message, say=MagicMock())
        callback.assert_called_once_with("hello world")
