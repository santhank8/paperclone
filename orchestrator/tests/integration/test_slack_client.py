"""Integration tests for Slack client — requires real Slack webhook URL.

Run manually or on schedule, not on every PR.
Requires SLACK_WEBHOOK_URL environment variable.
"""

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("SLACK_WEBHOOK_URL"),
    reason="SLACK_WEBHOOK_URL not set — skipping integration tests",
)


class TestSlackClientIntegration:
    """Tests against the real Slack API."""

    @pytest.fixture(autouse=True)
    def _setup(self):
        from src.tools.slack_client import SlackClient

        self.client = SlackClient(
            webhook_url=os.environ["SLACK_WEBHOOK_URL"],
        )

    @pytest.mark.asyncio
    async def test_post_message(self) -> None:
        """Post a test message to the webhook channel."""
        await self.client.post(
            "\U0001f9ea [Integration Test] Slack client is working."
        )
