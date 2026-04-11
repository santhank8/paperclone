"""Unit tests for GitHub App credential loading."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.state import SDLCState
from src.tools.github_client import GitHubClient, load_github_app_private_key


class TestLoadGitHubAppPrivateKey:
    def test_prefers_inline_env_key(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "GITHUB_APP_PRIVATE_KEY": "inline-private-key",
                "GITHUB_APP_PRIVATE_KEY_FILE": "/tmp/unused.pem",
            },
            clear=False,
        ):
            assert load_github_app_private_key() == "inline-private-key"

    def test_reads_private_key_from_file(self, tmp_path: Path) -> None:
        key_file = tmp_path / "app.pem"
        key_file.write_text("file-private-key", encoding="utf-8")

        with patch.dict(
            "os.environ",
            {
                "GITHUB_APP_PRIVATE_KEY": "",
                "GITHUB_APP_PRIVATE_KEY_FILE": str(key_file),
            },
            clear=False,
        ):
            assert load_github_app_private_key() == "file-private-key"

    def test_raises_when_file_is_unreadable(self, tmp_path: Path) -> None:
        missing_file = tmp_path / "missing.pem"

        with patch.dict(
            "os.environ",
            {
                "GITHUB_APP_PRIVATE_KEY": "",
                "GITHUB_APP_PRIVATE_KEY_FILE": str(missing_file),
            },
            clear=False,
        ):
            with pytest.raises(ValueError, match="not readable"):
                load_github_app_private_key()

    def test_raises_when_no_key_source_exists(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "GITHUB_APP_PRIVATE_KEY": "",
                "GITHUB_APP_PRIVATE_KEY_FILE": "",
            },
            clear=False,
        ):
            with pytest.raises(
                ValueError, match="GitHub App private key not found"
            ):
                load_github_app_private_key()


class TestGitHubClientFromState:
    def test_from_state_uses_loaded_private_key(self) -> None:
        state = SDLCState(
            project_config={"project": {"repo": "stepan-korec/trading-agent"}}
        )

        fake_integration = MagicMock()
        fake_installation = MagicMock(id=123)
        fake_integration.get_installations.return_value = [fake_installation]
        fake_repo = MagicMock()
        fake_gh = MagicMock()
        fake_gh.get_repo.return_value = fake_repo
        fake_integration.get_github_for_installation.return_value = fake_gh

        with patch.dict(
            "os.environ",
            {"GITHUB_APP_ID": "42", "GITHUB_APP_PRIVATE_KEY": "inline-key"},
            clear=False,
        ), patch(
            "src.tools.github_client.GithubIntegration",
            return_value=fake_integration,
        ):
            client = GitHubClient.from_state(state)

        assert client._repo is fake_repo
        assert client._repo_full_name == "stepan-korec/trading-agent"


class TestGitHubClientFileAccess:
    def test_get_file_contents_allows_non_excluded_path(self) -> None:
        content_file = MagicMock()
        content_file.decoded_content = b"allowed content"

        fake_repo = MagicMock()
        fake_repo.get_contents.return_value = content_file
        client = GitHubClient.__new__(GitHubClient)
        client._repo = fake_repo

        with patch(
            "src.tools.github_client.ensure_document_path_allowed"
        ) as allowed_check:
            result = GitHubClient.get_file_contents(
                client, "docs/specs/ARCHITECTURE.md", "main"
            )

        allowed_check.assert_called_once_with("docs/specs/ARCHITECTURE.md", persona=None)
        assert result == "allowed content"

    def test_get_file_contents_rejects_excluded_path(self) -> None:
        fake_repo = MagicMock()
        client = GitHubClient.__new__(GitHubClient)
        client._repo = fake_repo

        with patch(
            "src.tools.github_client.ensure_document_path_allowed",
            side_effect=ValueError(
                "Document path 'docs/archive/old-spec.md' is excluded by "
                "DOCUMENT_REGISTRY and cannot be fetched."
            ),
        ):
            with pytest.raises(ValueError, match="excluded by DOCUMENT_REGISTRY"):
                GitHubClient.get_file_contents(
                    client, "docs/archive/old-spec.md", "main"
                )

        fake_repo.get_contents.assert_not_called()


class TestGitHubClientPullRequestHelpers:
    def test_get_pr_changed_files_returns_filenames(self) -> None:
        file_a = MagicMock(filename="agent-workforce/src/graph.py")
        file_b = MagicMock(filename="services/pnl-service/main.py")
        pr = MagicMock()
        pr.get_files.return_value = [file_a, file_b]

        fake_repo = MagicMock()
        fake_repo.get_pull.return_value = pr
        client = GitHubClient.__new__(GitHubClient)
        client._repo = fake_repo

        changed = GitHubClient.get_pr_changed_files(client, 42)
        assert changed == [
            "agent-workforce/src/graph.py",
            "services/pnl-service/main.py",
        ]


class TestGitHubClientMemoryWrites:
    def test_append_to_document_creates_branch_and_pr(self) -> None:
        file_obj = MagicMock()
        file_obj.decoded_content = b"# Memory\n"
        file_obj.sha = "file-sha"
        created_pr = MagicMock(number=123, html_url="https://example/pr/123")
        main_ref = MagicMock()
        main_ref.object.sha = "main-sha"

        fake_repo = MagicMock()
        fake_repo.get_contents.return_value = file_obj
        fake_repo.get_git_ref.return_value = main_ref
        fake_repo.create_pull.return_value = created_pr

        client = GitHubClient.__new__(GitHubClient)
        client._repo = fake_repo

        result = GitHubClient.append_to_document(
            client, "docs/AGENT_MEMORY.md", "Story #42 completed."
        )

        assert "Memory PR #123" in result
        fake_repo.create_git_ref.assert_called_once()
        fake_repo.update_file.assert_called_once()
        update_kwargs = fake_repo.update_file.call_args.kwargs
        assert update_kwargs["branch"].startswith("memory/")
        assert update_kwargs["branch"] != "main"
        fake_repo.create_pull.assert_called_once()

    def test_prune_memory_document_uses_branch_and_pr(self) -> None:
        # 102 entries triggers pruning (MAX_MEMORY_ENTRIES = 100)
        entries = "\n".join([f"### ts{i}\nentry {i}" for i in range(102)])
        content = f"# Header\n{entries}\n".encode("utf-8")
        file_obj = MagicMock()
        file_obj.decoded_content = content
        file_obj.sha = "sha-1"
        main_ref = MagicMock()
        main_ref.object.sha = "main-sha"

        fake_repo = MagicMock()
        fake_repo.get_contents.return_value = file_obj
        fake_repo.get_git_ref.return_value = main_ref

        client = GitHubClient.__new__(GitHubClient)
        client._repo = fake_repo

        GitHubClient.prune_memory_document(client, "docs/AGENT_MEMORY.md")

        fake_repo.create_git_ref.assert_called_once()
        fake_repo.update_file.assert_called_once()
        update_kwargs = fake_repo.update_file.call_args.kwargs
        assert update_kwargs["branch"].startswith("memory/")
        assert update_kwargs["branch"] != "main"
        fake_repo.create_pull.assert_called_once()
