"""Container Apps Job dispatch + status polling.

Spec ref: AgenticSquad_Functional_Spec v2.8 RC §6.3.4, §9.4

Uses azure-mgmt-appcontainers SDK with DefaultAzureCredential
(managed identity in Container Apps, or CLI locally).
"""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

from azure.identity import DefaultAzureCredential
from azure.mgmt.appcontainers import ContainerAppsAPIClient
from azure.mgmt.appcontainers.models import (
    JobExecutionTemplate,
    JobExecutionContainer,
)

if TYPE_CHECKING:
    from ..state import SDLCState

logger = logging.getLogger(__name__)

DEFAULT_RESOURCE_GROUP = "rg-trading-agent-dev"
DEFAULT_SUBSCRIPTION_ID = ""  # Resolved from env or DefaultAzureCredential


class AzureJobClient:
    """Dispatch and poll Azure Container Apps Jobs."""

    def __init__(
        self,
        subscription_id: str,
        resource_group: str = DEFAULT_RESOURCE_GROUP,
    ) -> None:
        self._subscription_id = subscription_id
        self._resource_group = resource_group
        credential = DefaultAzureCredential()
        self._client = ContainerAppsAPIClient(
            credential=credential,
            subscription_id=self._subscription_id,
        )

    @classmethod
    def from_state(cls, state: SDLCState) -> AzureJobClient:
        """Create AzureJobClient from environment variables."""
        subscription_id = os.environ.get("AZURE_SUBSCRIPTION_ID", "")
        resource_group = os.environ.get(
            "AZURE_RESOURCE_GROUP", DEFAULT_RESOURCE_GROUP
        )
        return cls(
            subscription_id=subscription_id,
            resource_group=resource_group,
        )

    async def dispatch(
        self, job_name: str, env_vars: dict[str, str]
    ) -> str:
        """Start a Job execution with the given environment variables.

        Returns the execution name (used for polling).
        """
        containers = [
            JobExecutionContainer(
                name=job_name,
                image="",  # Uses the image configured on the Job resource
                env=[
                    {"name": k, "value": v} for k, v in env_vars.items()
                ],
            )
        ]

        template = JobExecutionTemplate(containers=containers)

        logger.info(
            f"Dispatching job {job_name} in {self._resource_group} "
            f"with {len(env_vars)} env vars"
        )

        # Start the job execution
        poller = self._client.jobs.begin_start(
            resource_group_name=self._resource_group,
            job_name=job_name,
            template=template,
        )

        # The poller result contains the execution name
        result = poller.result()
        execution_name: str = result.name
        logger.info(f"Job execution started: {execution_name}")
        return execution_name

    async def get_execution_status(
        self, job_name: str, execution_name: str
    ) -> str:
        """Poll the status of a Job execution.

        Returns one of: Running, Succeeded, Failed.
        """
        execution = self._client.jobs_executions.get(
            resource_group_name=self._resource_group,
            job_name=job_name,
            job_execution_name=execution_name,
        )
        status: str = execution.properties.status
        return status

    async def get_execution_logs(
        self, job_name: str, execution_name: str
    ) -> str:
        """Retrieve stdout logs from a completed Job execution.

        The Claude Code Runner writes a USAGE_JSON line as its last action,
        containing ``{"input_tokens": N, "output_tokens": N, "total_cost_usd": N}``.

        Log retrieval uses the Container Apps replicas API (console log stream).
        Falls back gracefully if logs are unavailable.
        """
        try:
            # List replicas for this execution to get the log stream
            replicas = self._client.container_apps_revision_replicas.list_replicas(
                resource_group_name=self._resource_group,
                container_app_name=job_name,
                revision_name=execution_name,
            )
            # Aggregate logs from the first replica
            for replica in replicas.value[:1]:
                log_stream = (
                    self._client.container_apps_revision_replicas
                    .get_replica(
                        resource_group_name=self._resource_group,
                        container_app_name=job_name,
                        revision_name=execution_name,
                        replica_name=replica.name,
                    )
                )
                return getattr(log_stream, "log_stream_endpoint", "") or ""
            return ""
        except Exception as e:
            logger.warning(
                f"Could not retrieve logs for {execution_name}: {e}"
            )
            return ""
