"""Integration tests for GitHub client — requires real GitHub App credentials.

Run manually or on schedule, not on every PR.
Requires GITHUB_APP_ID and either GITHUB_APP_PRIVATE_KEY or
GITHUB_APP_PRIVATE_KEY_FILE.
"""

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("GITHUB_APP_ID")
    or not (
        os.environ.get("GITHUB_APP_PRIVATE_KEY")
        or os.environ.get("GITHUB_APP_PRIVATE_KEY_FILE")
    ),
    reason=(
        "GitHub App credentials not fully set — "
        "skipping integration tests"
    ),
)


class TestGitHubClientIntegration:
    """Tests against the real GitHub API using a test repository."""

    @pytest.fixture(autouse=True)
    def _setup(self):
        from src.state import SDLCState
        from src.tools.github_client import GitHubClient

        state = SDLCState(
            project_config={"project": {"repo": "stepan-korec/trading-agent"}}
        )
        self.client = GitHubClient.from_state(state)

    def test_generate_installation_token(self) -> None:
        token = self.client.generate_installation_token()
        assert token
        assert len(token) > 10

    def test_get_issue(self) -> None:
        # Issue #1 should always exist in the repo
        issue = self.client.get_issue(1)
        assert issue.number == 1
        assert issue.title

    def test_find_pr_for_nonexistent_branch(self) -> None:
        pr = self.client.find_pr_for_branch("nonexistent-branch-xyz-12345")
        assert pr is None
