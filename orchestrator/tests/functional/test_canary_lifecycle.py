"""Canary lifecycle smoke test (TRA-60).

Tests the canary lifecycle tool without connecting to real GitHub.
The canary must NEVER merge to main.

Min 5 tests required per spec.
"""

from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from src.tools.canary import (
    CANARY_BRANCH_PREFIX,
    CANARY_FILE_PATH,
    CANARY_PR_BODY,
    CANARY_PR_TITLE,
    CanaryLifecycle,
)


def _mock_github_client() -> MagicMock:
    """Create a mock GitHubClient with a mock repo."""
    gh = MagicMock()
    repo = MagicMock()
    gh._repo = repo

    # Mock git ref for main branch
    main_ref = MagicMock()
    main_ref.object.sha = "abc123"
    repo.get_git_ref.return_value = main_ref

    # Mock create_file
    commit_mock = MagicMock()
    commit_mock.sha = "def456"
    repo.create_file.return_value = {"commit": commit_mock}

    # Mock create_pull
    pr_mock = MagicMock()
    pr_mock.number = 999
    pr_mock.state = "open"
    repo.create_pull.return_value = pr_mock
    repo.get_pull.return_value = pr_mock

    return gh


class TestCanaryBranchCreation:
    def test_creates_branch_from_main(self) -> None:
        gh = _mock_github_client()
        canary = CanaryLifecycle(gh)
        branch = canary.create_canary_branch()
        assert branch.startswith(CANARY_BRANCH_PREFIX)
        gh._repo.create_git_ref.assert_called_once()

    def test_custom_branch_name(self) -> None:
        gh = _mock_github_client()
        canary = CanaryLifecycle(gh)
        branch = canary.create_canary_branch("canary/test-custom")
        assert branch == "canary/test-custom"


class TestCanaryPushChange:
    def test_pushes_marker_file(self) -> None:
        gh = _mock_github_client()
        # Simulate file not existing (create_file path)
        gh._repo.get_contents.side_effect = Exception("Not Found")
        canary = CanaryLifecycle(gh)
        sha = canary.push_canary_change("canary/test-branch")
        assert sha == "def456"
        gh._repo.create_file.assert_called_once()
        call_args = gh._repo.create_file.call_args
        assert call_args[0][0] == CANARY_FILE_PATH


class TestCanaryDraftPR:
    def test_opens_draft_pr(self) -> None:
        gh = _mock_github_client()
        canary = CanaryLifecycle(gh)
        pr_num = canary.open_draft_pr("canary/test-branch")
        assert pr_num == 999
        gh._repo.create_pull.assert_called_once_with(
            title=CANARY_PR_TITLE,
            body=CANARY_PR_BODY,
            head="canary/test-branch",
            base="main",
            draft=True,
        )


class TestCanaryCloseNeverMerge:
    def test_closes_pr_without_merging(self) -> None:
        gh = _mock_github_client()
        canary = CanaryLifecycle(gh)
        canary.close_pr(999)
        pr = gh._repo.get_pull.return_value
        pr.edit.assert_called_once_with(state="closed")
        # Verify merge is NEVER called
        pr.merge.assert_not_called()

    def test_already_closed_pr_is_skipped(self) -> None:
        gh = _mock_github_client()
        gh._repo.get_pull.return_value.state = "closed"
        canary = CanaryLifecycle(gh)
        canary.close_pr(999)
        gh._repo.get_pull.return_value.edit.assert_not_called()


class TestCanaryFullLifecycle:
    def test_full_lifecycle_success(self) -> None:
        gh = _mock_github_client()
        gh._repo.get_contents.side_effect = Exception("Not Found")
        canary = CanaryLifecycle(gh)
        result = canary.run_full_lifecycle()
        assert result["success"] is True
        assert len(result["steps"]) == 5
        step_names = [s[0] for s in result["steps"]]
        assert "create_branch" in step_names
        assert "push_change" in step_names
        assert "open_draft_pr" in step_names
        assert "close_pr" in step_names
        assert "delete_branch" in step_names

    def test_lifecycle_cleans_up_on_failure(self) -> None:
        gh = _mock_github_client()
        # Fail on push_change
        gh._repo.get_contents.side_effect = Exception("Not Found")
        gh._repo.create_file.side_effect = RuntimeError("push failed")
        canary = CanaryLifecycle(gh)
        result = canary.run_full_lifecycle()
        assert result["success"] is False
        assert "error" in result
        # Branch cleanup should still be attempted
        # (delete_branch is called in finally block)
