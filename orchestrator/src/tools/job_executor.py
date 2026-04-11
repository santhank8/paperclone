"""Execution backends for Claude Code Runner jobs."""

from __future__ import annotations

import logging
import os
import time
from abc import ABC, abstractmethod
from urllib.parse import quote

import httpx

from .azure_jobs import AzureJobClient
from .github_client import DEFAULT_REPO

logger = logging.getLogger(__name__)

DEFAULT_AZURE_JOB_NAME = "caj-claude-code-runner"
DEFAULT_DOCKER_SOCKET = "/var/run/docker.sock"
DEFAULT_VPS_RUNNER_IMAGE = "trading-agent-workforce-claude-code-runner:latest"
DEFAULT_VPS_NETWORK = "trading-agent"
DEFAULT_BRANCH_PREFIX = "feat/issue-"
DEFAULT_MAX_TURNS = "50"
DEFAULT_EXECUTION_BACKEND = "vps"


def _get_required_env(name: str) -> str:
    """Load a required environment variable with an explicit error."""
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError(
            f"{name} is required for Claude Code runner execution and "
            "cannot be empty."
        )
    return value


class JobExecutor(ABC):
    """Backend-agnostic execution contract for Code Operator jobs."""

    @abstractmethod
    async def dispatch(
        self,
        *,
        issue_number: int,
        issue_body: str,
        git_token: str,
        retry_context: str = "",
    ) -> str:
        """Start a coding job and return an execution ID."""

    @abstractmethod
    async def get_status(self, execution_id: str) -> str:
        """Return the current execution status."""

    @abstractmethod
    async def get_logs(self, execution_id: str) -> str:
        """Return execution logs if available."""

    @abstractmethod
    async def cleanup(self, execution_id: str) -> None:
        """Release backend resources for a completed execution."""


class AzureJobExecutor(JobExecutor):
    """Adapter over the existing Azure Container Apps job client."""

    def __init__(
        self,
        client: AzureJobClient,
        job_name: str = DEFAULT_AZURE_JOB_NAME,
    ) -> None:
        self._client = client
        self._job_name = job_name

    @classmethod
    def from_state(cls, state) -> "AzureJobExecutor":
        execution_config = state.project_config.get("execution", {})
        job_name = execution_config.get("azure_job_name", DEFAULT_AZURE_JOB_NAME)
        return cls(AzureJobClient.from_state(state), job_name=job_name)

    async def dispatch(
        self,
        *,
        issue_number: int,
        issue_body: str,
        git_token: str,
        retry_context: str = "",
    ) -> str:
        return await self._client.dispatch(
            job_name=self._job_name,
            env_vars={
                "ISSUE_NUMBER": str(issue_number),
                "ISSUE_BODY": issue_body,
                "GIT_TOKEN": git_token,
                "RETRY_CONTEXT": retry_context,
            },
        )

    async def get_status(self, execution_id: str) -> str:
        return await self._client.get_execution_status(
            job_name=self._job_name,
            execution_name=execution_id,
        )

    async def get_logs(self, execution_id: str) -> str:
        return await self._client.get_execution_logs(
            job_name=self._job_name,
            execution_name=execution_id,
        )

    async def cleanup(self, execution_id: str) -> None:
        return None


class VpsDockerExecutor(JobExecutor):
    """Run Claude Code Runner containers directly through the Docker socket."""

    def __init__(
        self,
        *,
        image: str = DEFAULT_VPS_RUNNER_IMAGE,
        docker_socket: str = DEFAULT_DOCKER_SOCKET,
        network: str = DEFAULT_VPS_NETWORK,
        repo: str = DEFAULT_REPO,
        branch_prefix: str = DEFAULT_BRANCH_PREFIX,
        max_turns: str = DEFAULT_MAX_TURNS,
    ) -> None:
        self._image = image
        self._docker_socket = docker_socket
        self._network = network
        self._repo = repo
        self._branch_prefix = branch_prefix
        self._max_turns = str(max_turns)

    @classmethod
    def from_state(cls, state) -> "VpsDockerExecutor":
        execution_config = state.project_config.get("execution", {})
        return cls(
            image=execution_config.get(
                "vps_runner_image", DEFAULT_VPS_RUNNER_IMAGE
            ),
            docker_socket=execution_config.get(
                "vps_docker_socket", DEFAULT_DOCKER_SOCKET
            ),
            network=execution_config.get("vps_network", DEFAULT_VPS_NETWORK),
            repo=state.project_config.get("project", {}).get(
                "repo", DEFAULT_REPO
            ),
            branch_prefix=execution_config.get(
                "branch_prefix", DEFAULT_BRANCH_PREFIX
            ),
            max_turns=str(
                execution_config.get("runner_max_turns", DEFAULT_MAX_TURNS)
            ),
        )

    async def _request(
        self, method: str, path: str, *, json: dict | None = None
    ) -> httpx.Response:
        transport = httpx.AsyncHTTPTransport(uds=self._docker_socket)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://docker"
        ) as client:
            response = await client.request(method, path, json=json)

        if response.status_code >= 400:
            detail = response.text.strip() or response.reason_phrase
            raise RuntimeError(
                f"Docker API {method} {path} failed: "
                f"{response.status_code} {detail}"
            )
        return response

    async def dispatch(
        self,
        *,
        issue_number: int,
        issue_body: str,
        git_token: str,
        retry_context: str = "",
    ) -> str:
        container_name = (
            f"claude-code-runner-{issue_number}-{int(time.time())}"
        )
        env_vars = {
            "ANTHROPIC_API_KEY": _get_required_env("ANTHROPIC_API_KEY"),
            "ISSUE_NUMBER": str(issue_number),
            "ISSUE_BODY": issue_body,
            "GIT_TOKEN": git_token,
            "RETRY_CONTEXT": retry_context,
            "REPO": self._repo,
            "BRANCH_PREFIX": self._branch_prefix,
            "MAX_TURNS": self._max_turns,
        }
        payload = {
            "Image": self._image,
            "Env": [f"{key}={value}" for key, value in env_vars.items()],
            "Labels": {
                "trading-agent.execution_backend": "vps",
                "trading-agent.issue_number": str(issue_number),
            },
            "HostConfig": {
                "AutoRemove": False,
                "NetworkMode": self._network,
            },
        }
        create_response = await self._request(
            "POST",
            f"/containers/create?name={quote(container_name)}",
            json=payload,
        )
        execution_id = create_response.json()["Id"]
        await self._request("POST", f"/containers/{execution_id}/start")
        logger.info(
            "Started VPS Claude Code runner container %s for issue #%s",
            execution_id,
            issue_number,
        )
        return execution_id

    async def get_status(self, execution_id: str) -> str:
        response = await self._request("GET", f"/containers/{execution_id}/json")
        state = response.json().get("State", {})

        if state.get("Running") or state.get("Status") in {"created", "restarting"}:
            return "Running"
        if state.get("Status") == "exited":
            return "Succeeded" if state.get("ExitCode") == 0 else "Failed"
        return "Failed"

    async def get_logs(self, execution_id: str) -> str:
        response = await self._request(
            "GET",
            f"/containers/{execution_id}/logs?stdout=1&stderr=1",
        )
        return response.text

    async def cleanup(self, execution_id: str) -> None:
        try:
            await self._request("DELETE", f"/containers/{execution_id}?force=1")
        except RuntimeError as exc:
            logger.warning(
                "Failed to clean up VPS runner container %s: %s",
                execution_id,
                exc,
            )


def create_job_executor(state) -> JobExecutor:
    """Instantiate the configured execution backend."""
    execution_config = state.project_config.get("execution", {})
    backend = (
        os.environ.get("WORKFORCE_EXECUTION_BACKEND")
        or execution_config.get("backend")
        or DEFAULT_EXECUTION_BACKEND
    ).lower()

    if backend == "azure":
        return AzureJobExecutor.from_state(state)
    if backend == "vps":
        return VpsDockerExecutor.from_state(state)
    raise ValueError(
        f"Unsupported execution backend '{backend}'. "
        "Expected 'azure' or 'vps'."
    )
