"""Canary lifecycle tool — creates and cleans up a throwaway story.

TRA-60: End-to-end smoke test canary. Creates a branch, pushes a trivial
change, opens a draft PR, then closes it WITHOUT merging.

IMPORTANT: The canary must NEVER merge to main.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

CANARY_BRANCH_PREFIX = "canary/smoke-test-"
CANARY_FILE_PATH = "agent-workforce/tests/functional/.canary-marker"
CANARY_COMMIT_MESSAGE = "canary: smoke test marker (auto-cleanup)"
CANARY_PR_TITLE = "[CANARY] Smoke test — do not merge"
CANARY_PR_BODY = (
    "Automated canary lifecycle smoke test.\n\n"
    "This PR is opened as a draft and will be closed automatically.\n"
    "**DO NOT MERGE.**"
)


class CanaryLifecycle:
    """Manages the canary smoke test lifecycle.

    Steps:
    1. Create a branch from main
    2. Push a trivial change (marker file)
    3. Open a draft PR
    4. Close the PR without merging
    5. Delete the branch

    All operations are idempotent and safe to retry.
    """

    def __init__(self, github_client: object) -> None:
        """Initialize with a GitHubClient instance."""
        self._gh = github_client

    def _branch_name(self) -> str:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        return f"{CANARY_BRANCH_PREFIX}{ts}"

    def create_canary_branch(self, branch_name: Optional[str] = None) -> str:
        """Create a canary branch from main. Returns the branch name."""
        branch = branch_name or self._branch_name()
        repo = self._gh._repo  # type: ignore[attr-defined]
        main_ref = repo.get_git_ref("heads/main")
        repo.create_git_ref(
            ref=f"refs/heads/{branch}", sha=main_ref.object.sha
        )
        logger.info(f"Canary branch created: {branch}")
        return branch

    def push_canary_change(self, branch: str) -> str:
        """Push a trivial marker file to the canary branch. Returns file SHA."""
        repo = self._gh._repo  # type: ignore[attr-defined]
        ts = datetime.now(timezone.utc).isoformat()
        content = f"Canary smoke test marker — {ts}\n"

        try:
            existing = repo.get_contents(CANARY_FILE_PATH, ref=branch)
            result = repo.update_file(
                CANARY_FILE_PATH,
                CANARY_COMMIT_MESSAGE,
                content,
                existing.sha,
                branch=branch,
            )
        except Exception:
            result = repo.create_file(
                CANARY_FILE_PATH,
                CANARY_COMMIT_MESSAGE,
                content,
                branch=branch,
            )

        sha = result["commit"].sha
        logger.info(f"Canary change pushed to {branch}: {sha}")
        return sha

    def open_draft_pr(self, branch: str) -> int:
        """Open a draft PR from the canary branch. Returns PR number."""
        repo = self._gh._repo  # type: ignore[attr-defined]
        pr = repo.create_pull(
            title=CANARY_PR_TITLE,
            body=CANARY_PR_BODY,
            head=branch,
            base="main",
            draft=True,
        )
        logger.info(f"Canary draft PR opened: #{pr.number}")
        return pr.number

    def close_pr(self, pr_number: int) -> None:
        """Close the canary PR without merging."""
        repo = self._gh._repo  # type: ignore[attr-defined]
        pr = repo.get_pull(pr_number)
        if pr.state == "open":
            pr.edit(state="closed")
            pr.create_issue_comment(
                "Canary smoke test complete — closing without merge."
            )
        logger.info(f"Canary PR #{pr_number} closed (NOT merged)")

    def delete_branch(self, branch: str) -> None:
        """Delete the canary branch."""
        repo = self._gh._repo  # type: ignore[attr-defined]
        try:
            ref = repo.get_git_ref(f"heads/{branch}")
            ref.delete()
            logger.info(f"Canary branch deleted: {branch}")
        except Exception as e:
            logger.warning(f"Could not delete canary branch {branch}: {e}")

    def run_full_lifecycle(self) -> dict:
        """Execute the full canary lifecycle: create → push → PR → close → delete.

        Returns a dict with lifecycle details.
        """
        result: dict = {"success": False, "steps": []}
        branch = None
        pr_number = None

        try:
            branch = self.create_canary_branch()
            result["steps"].append(("create_branch", branch))

            sha = self.push_canary_change(branch)
            result["steps"].append(("push_change", sha))

            pr_number = self.open_draft_pr(branch)
            result["steps"].append(("open_draft_pr", pr_number))

            self.close_pr(pr_number)
            result["steps"].append(("close_pr", pr_number))

            self.delete_branch(branch)
            result["steps"].append(("delete_branch", branch))

            result["success"] = True
            logger.info("Canary lifecycle completed successfully")

        except Exception as e:
            logger.error(f"Canary lifecycle failed: {e}")
            result["error"] = str(e)

            # Best-effort cleanup
            if pr_number:
                try:
                    self.close_pr(pr_number)
                except Exception:
                    pass
            if branch:
                try:
                    self.delete_branch(branch)
                except Exception:
                    pass

        return result
