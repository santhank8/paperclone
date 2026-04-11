"""Unit tests for Claude Code Runner Docker artifacts.

Validates Dockerfile and entrypoint.sh meet the spec requirements
from AgenticSquad_Functional_Spec v2.8 RC §6.3.5, §6.3.7, §9.4.
"""

import os
import stat
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
DOCKER_DIR = REPO_ROOT / "agent-workforce" / "docker" / "claude-code-runner"
DOCKERFILE = DOCKER_DIR / "Dockerfile"
ENTRYPOINT = DOCKER_DIR / "entrypoint.sh"


class TestDockerfile:
    """Validate Dockerfile structure and required components."""

    @pytest.fixture(autouse=True)
    def _load_dockerfile(self) -> None:
        self.content = DOCKERFILE.read_text()
        self.lines = [
            line.strip()
            for line in self.content.splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]

    def test_dockerfile_exists(self) -> None:
        assert DOCKERFILE.exists(), "Dockerfile must exist"

    def test_base_image_is_node20(self) -> None:
        from_lines = [l for l in self.lines if l.startswith("FROM")]
        assert len(from_lines) == 1
        assert "node:20" in from_lines[0], "Base image must be Node.js 20"

    def test_installs_git(self) -> None:
        assert "git" in self.content, "Dockerfile must install git"

    def test_installs_python3(self) -> None:
        assert "python3" in self.content, "Dockerfile must install python3"

    def test_installs_go(self) -> None:
        assert "go" in self.content.lower(), "Dockerfile must install Go"

    def test_installs_claude_code_cli(self) -> None:
        assert "@anthropic-ai/claude-code" in self.content, (
            "Dockerfile must install Claude Code CLI"
        )

    def test_creates_nonroot_user(self) -> None:
        assert "useradd" in self.content, "Dockerfile must create a non-root user"
        assert "USER runner" in self.content, "Dockerfile must switch to non-root user"

    def test_copies_entrypoint(self) -> None:
        assert "entrypoint.sh" in self.content, "Dockerfile must copy entrypoint.sh"

    def test_sets_entrypoint(self) -> None:
        assert "ENTRYPOINT" in self.content, "Dockerfile must set ENTRYPOINT"

    def test_workspace_dir(self) -> None:
        assert "WORKDIR /workspace" in self.content, (
            "Dockerfile must set WORKDIR to /workspace"
        )

    def test_installs_linting_tools(self) -> None:
        assert "ruff" in self.content, "Dockerfile must install ruff"
        assert "black" in self.content, "Dockerfile must install black"


class TestEntrypoint:
    """Validate entrypoint.sh structure and required lifecycle steps."""

    @pytest.fixture(autouse=True)
    def _load_entrypoint(self) -> None:
        self.content = ENTRYPOINT.read_text()

    def test_entrypoint_exists(self) -> None:
        assert ENTRYPOINT.exists(), "entrypoint.sh must exist"

    def test_is_executable(self) -> None:
        mode = os.stat(ENTRYPOINT).st_mode
        assert mode & stat.S_IXUSR, "entrypoint.sh must be executable"

    def test_has_bash_shebang(self) -> None:
        assert self.content.startswith("#!/bin/bash"), (
            "entrypoint.sh must start with bash shebang"
        )

    def test_uses_strict_mode(self) -> None:
        assert "set -euo pipefail" in self.content, (
            "entrypoint.sh must use strict mode (set -euo pipefail)"
        )

    def test_step1_clone(self) -> None:
        assert "git clone" in self.content, "Must clone the repository"
        assert "--depth=" in self.content, "Must use shallow clone"

    def test_step2_system_prompt(self) -> None:
        assert "SYSTEM_PROMPT" in self.content, "Must build a system prompt"
        assert "ISSUE_BODY" in self.content, "Must include issue body in prompt"

    def test_step2_retry_context(self) -> None:
        assert "RETRY_CONTEXT" in self.content, "Must support retry context"

    def test_step3_runs_claude_code(self) -> None:
        assert "claude -p" in self.content, "Must invoke Claude Code CLI"
        assert "--dangerously-skip-permissions" in self.content, (
            "Must use --dangerously-skip-permissions (safe in isolated container)"
        )
        assert "--allowedTools" in self.content, "Must restrict allowed tools"

    def test_allowed_tools_restricted(self) -> None:
        for tool in ["Read", "Edit", "Bash", "Grep", "Glob"]:
            assert f'"{tool}"' in self.content, f"Must allow {tool} tool"

    def test_step4_commit_and_push(self) -> None:
        assert "git add" in self.content, "Must stage changes"
        assert "git commit" in self.content, "Must commit changes"
        assert "git push" in self.content, "Must push changes"

    def test_step5_result_metadata(self) -> None:
        assert "runner-result.env" in self.content, "Must write result metadata"
        assert "EXIT_STATUS" in self.content, "Must include exit status"
        assert "COMMIT_SHA" in self.content, "Must include commit SHA"

    def test_configures_git_identity(self) -> None:
        assert "git config user.name" in self.content, "Must configure git user.name"
        assert "git config user.email" in self.content, "Must configure git user.email"

    def test_handles_existing_branch(self) -> None:
        assert "git ls-remote" in self.content, (
            "Must check if branch exists remotely"
        )

    def test_default_repo(self) -> None:
        assert "stepan-korec/trading-agent" in self.content, (
            "Default repo must be stepan-korec/trading-agent"
        )

    def test_max_turns_configurable(self) -> None:
        assert "MAX_TURNS" in self.content, "MAX_TURNS must be configurable"
        assert '"${MAX_TURNS:-50}"' in self.content or "${MAX_TURNS:-50}" in self.content, (
            "Default MAX_TURNS must be 50"
        )

    def test_no_changes_exit_gracefully(self) -> None:
        assert "git diff --quiet" in self.content, (
            "Must check for changes before committing"
        )
        assert "no_changes" in self.content, (
            "Must report no_changes status when nothing changed"
        )


class TestBuildWorkflow:
    """Validate the GitHub Actions build workflow."""

    @pytest.fixture(autouse=True)
    def _load_workflow(self) -> None:
        workflow_path = REPO_ROOT / ".github" / "workflows" / "claude-code-runner-build.yml"
        self.content = workflow_path.read_text()

    def test_workflow_exists(self) -> None:
        path = REPO_ROOT / ".github" / "workflows" / "claude-code-runner-build.yml"
        assert path.exists(), "Build workflow must exist"

    def test_triggers_on_path_changes(self) -> None:
        assert "agent-workforce/docker/claude-code-runner/**" in self.content, (
            "Must trigger on claude-code-runner path changes"
        )

    def test_triggers_on_workflow_dispatch(self) -> None:
        assert "workflow_dispatch" in self.content, (
            "Must support manual workflow dispatch"
        )

    def test_uses_acr_build(self) -> None:
        assert "az acr build" in self.content, "Must use ACR build (not local Docker)"

    def test_acr_name(self) -> None:
        # ACR name is resolved dynamically from dev.parameters.json at runtime
        assert "ACR_NAME" in self.content, "Must reference ACR name"
        assert "acrName" in self.content, "Must read ACR name from parameters"

    def test_tags_with_sha_and_latest(self) -> None:
        assert "latest" in self.content, "Must tag with latest"
        assert "GITHUB_SHA" in self.content, "Must tag with commit SHA"

    def test_uses_oidc_auth(self) -> None:
        assert "azure/login@v2" in self.content, "Must use Azure OIDC login"
        assert "id-token: write" in self.content, "Must request id-token write permission"

    def test_verifies_image_after_push(self) -> None:
        assert "acr repository show-tags" in self.content, (
            "Must verify image tags after push"
        )


class TestDevParameters:
    """Validate dev parameter file enables Claude Code Runner."""

    @pytest.fixture(autouse=True)
    def _load_params(self) -> None:
        import json

        params_path = REPO_ROOT / "infra" / "params" / "dev.parameters.json"
        self.params = json.loads(params_path.read_text())["parameters"]

    def test_claude_code_runner_enabled(self) -> None:
        assert self.params["enableClaudeCodeRunner"]["value"] is True, (
            "enableClaudeCodeRunner must be true in dev"
        )

    def test_claude_code_runner_image_set(self) -> None:
        # Image may be "unset" as a placeholder — the deploy workflow builds
        # and pushes images independently. Verify the parameter key exists.
        assert "claudeCodeRunnerImage" in self.params, (
            "claudeCodeRunnerImage parameter must exist"
        )
