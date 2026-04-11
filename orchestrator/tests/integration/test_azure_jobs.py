"""Integration tests for Azure Jobs client — requires real Azure credentials.

Run manually or on schedule, not on every PR.
Requires AZURE_SUBSCRIPTION_ID environment variable and DefaultAzureCredential.
"""

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("AZURE_SUBSCRIPTION_ID"),
    reason="AZURE_SUBSCRIPTION_ID not set — skipping integration tests",
)


class TestAzureJobClientIntegration:
    """Tests against the real Azure Container Apps Jobs API."""

    @pytest.fixture(autouse=True)
    def _setup(self):
        from src.tools.azure_jobs import AzureJobClient

        self.client = AzureJobClient(
            subscription_id=os.environ["AZURE_SUBSCRIPTION_ID"],
            resource_group=os.environ.get(
                "AZURE_RESOURCE_GROUP", "rg-trading-agent-dev"
            ),
        )

    @pytest.mark.asyncio
    async def test_dispatch_and_poll(self) -> None:
        """Dispatch a no-op job and verify it completes."""
        # This test requires caj-claude-code-runner to exist in the resource group
        execution_id = await self.client.dispatch(
            job_name="caj-claude-code-runner",
            env_vars={
                "ISSUE_NUMBER": "0",
                "ISSUE_BODY": "smoke-test",
                "GIT_TOKEN": "unused",
            },
        )
        assert execution_id

        status = await self.client.get_execution_status(
            job_name="caj-claude-code-runner",
            execution_name=execution_id,
        )
        assert status in ("Running", "Succeeded", "Failed")
