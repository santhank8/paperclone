"""Unit tests for execution backend selection and lifecycle."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.state import SDLCState
from src.tools.job_executor import (
    AzureJobExecutor,
    VpsDockerExecutor,
    create_job_executor,
)


class _FakeResponse:
    def __init__(
        self,
        *,
        status_code: int = 200,
        json_data: dict | None = None,
        text: str = "",
        reason_phrase: str = "OK",
    ) -> None:
        self.status_code = status_code
        self._json_data = json_data or {}
        self.text = text
        self.reason_phrase = reason_phrase

    def json(self) -> dict:
        return self._json_data


class TestCreateJobExecutor:
    def test_defaults_to_vps_backend(self) -> None:
        state = SDLCState(project_config={"execution": {}})

        with patch(
            "src.tools.job_executor.VpsDockerExecutor.from_state",
            return_value="vps-executor",
        ) as factory:
            result = create_job_executor(state)

        assert result == "vps-executor"
        factory.assert_called_once_with(state)

    def test_selects_vps_backend(self) -> None:
        state = SDLCState(project_config={"execution": {"backend": "vps"}})

        with patch(
            "src.tools.job_executor.VpsDockerExecutor.from_state",
            return_value="vps-executor",
        ) as factory:
            result = create_job_executor(state)

        assert result == "vps-executor"
        factory.assert_called_once_with(state)

    def test_env_override_selects_vps_backend(self) -> None:
        state = SDLCState(project_config={"execution": {"backend": "azure"}})

        with patch.dict(
            "os.environ", {"WORKFORCE_EXECUTION_BACKEND": "vps"}, clear=False
        ), patch(
            "src.tools.job_executor.VpsDockerExecutor.from_state",
            return_value="vps-executor",
        ) as factory:
            result = create_job_executor(state)

        assert result == "vps-executor"
        factory.assert_called_once_with(state)

    def test_raises_on_unknown_backend(self) -> None:
        state = SDLCState(project_config={"execution": {"backend": "nope"}})

        with pytest.raises(ValueError, match="Unsupported execution backend"):
            create_job_executor(state)


class TestAzureJobExecutor:
    @pytest.mark.asyncio
    async def test_dispatch_wraps_existing_azure_client(self) -> None:
        azure_client = MagicMock()
        azure_client.dispatch = AsyncMock(return_value="exec-123")
        executor = AzureJobExecutor(azure_client, job_name="caj-runner")

        execution_id = await executor.dispatch(
            issue_number=42,
            issue_body="Implement story",
            git_token="ghs-token",
            retry_context="retry info",
        )

        assert execution_id == "exec-123"
        azure_client.dispatch.assert_awaited_once_with(
            job_name="caj-runner",
            env_vars={
                "ISSUE_NUMBER": "42",
                "ISSUE_BODY": "Implement story",
                "GIT_TOKEN": "ghs-token",
                "RETRY_CONTEXT": "retry info",
            },
        )


class TestVpsDockerExecutor:
    @pytest.mark.asyncio
    async def test_dispatch_creates_and_starts_container(self) -> None:
        executor = VpsDockerExecutor(
            image="runner:latest",
            network="trading-agent",
            repo="stepan-korec/trading-agent",
            branch_prefix="feat/issue-",
            max_turns="50",
        )

        create_response = _FakeResponse(json_data={"Id": "container-123"})
        start_response = _FakeResponse(status_code=204)

        with patch.object(
            executor,
            "_request",
            AsyncMock(side_effect=[create_response, start_response]),
        ) as request_mock, patch.dict(
            "os.environ", {"ANTHROPIC_API_KEY": "secret-key"}, clear=False
        ):
            execution_id = await executor.dispatch(
                issue_number=42,
                issue_body="Implement story",
                git_token="ghs-token",
                retry_context="retry info",
            )

        assert execution_id == "container-123"
        create_call = request_mock.await_args_list[0]
        assert create_call.args[0] == "POST"
        assert create_call.args[1].startswith("/containers/create?name=")
        payload = create_call.kwargs["json"]
        assert payload["Image"] == "runner:latest"
        assert "ISSUE_NUMBER=42" in payload["Env"]
        assert "GIT_TOKEN=ghs-token" in payload["Env"]
        assert "RETRY_CONTEXT=retry info" in payload["Env"]
        assert "ANTHROPIC_API_KEY=secret-key" in payload["Env"]
        assert payload["HostConfig"]["NetworkMode"] == "trading-agent"

        start_call = request_mock.await_args_list[1]
        assert start_call.args == ("POST", "/containers/container-123/start")

    @pytest.mark.asyncio
    async def test_dispatch_requires_anthropic_api_key(self) -> None:
        executor = VpsDockerExecutor()

        with patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""}, clear=False):
            with pytest.raises(
                ValueError, match="ANTHROPIC_API_KEY is required"
            ):
                await executor.dispatch(
                    issue_number=42,
                    issue_body="Implement story",
                    git_token="ghs-token",
                )

    @pytest.mark.asyncio
    async def test_get_status_maps_running_container(self) -> None:
        executor = VpsDockerExecutor()
        with patch.object(
            executor,
            "_request",
            AsyncMock(
                return_value=_FakeResponse(
                    json_data={"State": {"Running": True, "Status": "running"}}
                )
            ),
        ):
            status = await executor.get_status("container-123")

        assert status == "Running"

    @pytest.mark.asyncio
    async def test_get_status_maps_successful_exit(self) -> None:
        executor = VpsDockerExecutor()
        with patch.object(
            executor,
            "_request",
            AsyncMock(
                return_value=_FakeResponse(
                    json_data={"State": {"Status": "exited", "ExitCode": 0}}
                )
            ),
        ):
            status = await executor.get_status("container-123")

        assert status == "Succeeded"

    @pytest.mark.asyncio
    async def test_get_status_maps_failed_exit(self) -> None:
        executor = VpsDockerExecutor()
        with patch.object(
            executor,
            "_request",
            AsyncMock(
                return_value=_FakeResponse(
                    json_data={"State": {"Status": "exited", "ExitCode": 1}}
                )
            ),
        ):
            status = await executor.get_status("container-123")

        assert status == "Failed"

    @pytest.mark.asyncio
    async def test_get_logs_reads_container_logs(self) -> None:
        executor = VpsDockerExecutor()
        with patch.object(
            executor,
            "_request",
            AsyncMock(return_value=_FakeResponse(text="runner logs")),
        ):
            logs = await executor.get_logs("container-123")

        assert logs == "runner logs"

    @pytest.mark.asyncio
    async def test_cleanup_force_removes_container(self) -> None:
        executor = VpsDockerExecutor()
        with patch.object(executor, "_request", AsyncMock()) as request_mock:
            await executor.cleanup("container-123")

        request_mock.assert_awaited_once_with(
            "DELETE", "/containers/container-123?force=1"
        )

    @pytest.mark.asyncio
    async def test_cleanup_swallows_backend_errors(self) -> None:
        executor = VpsDockerExecutor()
        with patch.object(
            executor,
            "_request",
            AsyncMock(side_effect=RuntimeError("gone")),
        ):
            await executor.cleanup("container-123")
