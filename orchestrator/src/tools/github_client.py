"""PyGithub wrapper with GitHub App authentication.

Spec ref: AgenticSquad_Functional_Spec v2.8 RC §9.1, §15.2

Auth flow:
1. Read GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY from environment
2. Create JWT signed with private key (10 min expiry)
3. Exchange JWT for installation token via POST /app/installations/{id}/access_tokens
4. Use installation token for all API calls
5. Token valid for 1 hour — regenerate on 401
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from typing import TYPE_CHECKING, Optional

import jwt
import httpx
from github import Auth, Github, GithubIntegration

from ..config_loader import ensure_document_path_allowed

if TYPE_CHECKING:
    from github.Issue import Issue
    from github.PullRequest import PullRequest

    from ..state import SDLCState

logger = logging.getLogger(__name__)

# GitHub App constants
DEFAULT_REPO = "stepan-korec/trading-agent"


def load_github_app_private_key() -> str:
    """Load the GitHub App private key from env or a mounted file.

    Resolution order preserves existing behavior:
    1. ``GITHUB_APP_PRIVATE_KEY`` if present and non-empty
    2. ``GITHUB_APP_PRIVATE_KEY_FILE`` if present and readable

    Raises:
        ValueError: When neither source is configured or readable.
    """
    private_key = os.environ.get("GITHUB_APP_PRIVATE_KEY", "").strip()
    if private_key:
        return private_key

    key_file = os.environ.get("GITHUB_APP_PRIVATE_KEY_FILE", "").strip()
    if key_file:
        path = Path(key_file)
        if path.is_file() and os.access(path, os.R_OK):
            return path.read_text(encoding="utf-8")
        raise ValueError(
            "GitHub App private key file is not readable: "
            f"{key_file}. Set GITHUB_APP_PRIVATE_KEY or provide a readable "
            "GITHUB_APP_PRIVATE_KEY_FILE."
        )

    raise ValueError(
        "GitHub App private key not found. Set GITHUB_APP_PRIVATE_KEY "
        "(inline) or GITHUB_APP_PRIVATE_KEY_FILE (path to .pem file)."
    )


class GitHubClient:
    """Thin wrapper around PyGithub with GitHub App auth."""

    def __init__(
        self,
        app_id: str,
        private_key: str,
        repo_full_name: str = DEFAULT_REPO,
        installation_id: Optional[int] = None,
    ) -> None:
        self._app_id = int(app_id)
        self._private_key = private_key
        self._repo_full_name = repo_full_name
        self._installation_id = installation_id

        # Initialize the GitHub App integration
        auth = Auth.AppAuth(self._app_id, self._private_key)
        self._integration = GithubIntegration(auth=auth)

        # Resolve installation ID if not provided
        if self._installation_id is None:
            installations = self._integration.get_installations()
            if not installations:
                raise ValueError(
                    f"No installations found for GitHub App {self._app_id}"
                )
            self._installation_id = installations[0].id

        # Get an authenticated client for the installation
        self._gh = self._integration.get_github_for_installation(
            self._installation_id
        )
        self._repo = self._gh.get_repo(self._repo_full_name)

    @classmethod
    def from_state(cls, state: SDLCState) -> GitHubClient:
        """Create a GitHubClient from SDLCState project config or env vars."""
        app_id = os.environ.get("GITHUB_APP_ID", "")
        private_key = load_github_app_private_key()
        repo = state.project_config.get("project", {}).get(
            "repo", DEFAULT_REPO
        )
        return cls(app_id=app_id, private_key=private_key, repo_full_name=repo)

    def generate_installation_token(self) -> str:
        """Generate a short-lived installation token for git operations."""
        now = int(time.time())
        payload = {
            "iat": now - 60,  # Clock drift tolerance
            "exp": now + (10 * 60),  # 10 min expiry
            "iss": str(self._app_id),  # PyJWT requires iss to be a string
        }
        encoded_jwt = jwt.encode(
            payload, self._private_key, algorithm="RS256"
        )

        resp = httpx.post(
            f"https://api.github.com/app/installations/{self._installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {encoded_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        resp.raise_for_status()
        token: str = resp.json()["token"]
        return token

    def get_issue(self, number: int) -> Issue:
        """Fetch an issue by number."""
        return self._repo.get_issue(number)

    def update_issue_labels(
        self,
        number: int,
        add: Optional[list[str]] = None,
        remove: Optional[list[str]] = None,
    ) -> None:
        """Add and remove labels on an issue."""
        issue = self._repo.get_issue(number)

        if remove:
            current_labels = {l.name for l in issue.labels}
            for label in remove:
                if label in current_labels:
                    issue.remove_from_labels(label)

        if add:
            for label in add:
                issue.add_to_labels(label)

    def close_issue(self, number: int) -> None:
        """Close an issue with a completion comment."""
        issue = self._repo.get_issue(number)
        issue.create_comment("Closed by Agentic Squad — story complete.")
        issue.edit(state="closed")

    def create_issue(
        self,
        title: str,
        body: str,
        labels: Optional[list[str]] = None,
    ) -> Issue:
        """Create a new GitHub issue.

        Used by the SM to file operational defects, infrastructure issues,
        and other non-story issues discovered during workforce operation.
        """
        return self._repo.create_issue(
            title=title,
            body=body,
            labels=labels or [],
        )

    def find_pr_for_branch(self, branch: str) -> Optional[PullRequest]:
        """Find an open PR for the given head branch."""
        pulls = self._repo.get_pulls(state="open", head=branch)
        for pr in pulls:
            if pr.head.ref == branch:
                return pr
        return None

    def create_pr(
        self, title: str, body: str, head: str, base: str = "main"
    ) -> PullRequest:
        """Create a new pull request."""
        return self._repo.create_pull(
            title=title, body=body, head=head, base=base
        )

    def merge_pr(self, number: int) -> None:
        """Squash-merge a pull request."""
        pr = self._repo.get_pull(number)
        pr.merge(merge_method="squash")

    def get_issues_by_label(self, label: str) -> list:
        """Fetch open issues with a given label, sorted by priority."""
        issues = self._repo.get_issues(
            state="open", labels=[label], sort="created", direction="asc"
        )
        return list(issues)

    def get_pr(self, pr_number: int) -> PullRequest:
        """Fetch PR details."""
        return self._repo.get_pull(pr_number)

    def get_pr_diff(self, pr_number: int) -> str:
        """Fetch the unified diff of a PR."""
        pr = self._repo.get_pull(pr_number)
        files = pr.get_files()
        diff_parts = []
        for f in files:
            diff_parts.append(
                f"--- {f.filename}\n"
                f"+++ {f.filename}\n"
                f"Status: {f.status}, Changes: +{f.additions}/-{f.deletions}\n"
                f"{f.patch or ''}\n"
            )
        return "\n".join(diff_parts)

    def get_pr_changed_files(self, pr_number: int) -> list[str]:
        """Fetch changed file paths for a PR."""
        pr = self._repo.get_pull(pr_number)
        return [f.filename for f in pr.get_files()]

    def get_file_contents(
        self, path: str, ref: str, persona: str | None = None
    ) -> str:
        """Read a file from a specific branch or commit.

        Args:
            path: File path relative to repo root.
            ref: Branch name or commit SHA.
            persona: If provided, enforces persona-scoped document access.
        """
        ensure_document_path_allowed(path, persona=persona)
        content_file = self._repo.get_contents(path, ref=ref)
        return content_file.decoded_content.decode("utf-8")

    def post_pr_review(
        self, pr_number: int, event: str, body: str
    ) -> None:
        """Submit a review on a PR (APPROVE or REQUEST_CHANGES)."""
        pr = self._repo.get_pull(pr_number)
        pr.create_review(body=body, event=event)

    def trigger_workflow(
        self, workflow_file: str, inputs: dict
    ) -> int:
        """Trigger a workflow_dispatch and return the run ID."""
        workflow = self._repo.get_workflow(workflow_file)
        success = workflow.create_dispatch(ref="main", inputs=inputs)
        if not success:
            raise RuntimeError(f"Failed to dispatch {workflow_file}")
        # Wait briefly for the run to appear
        import time as _time

        _time.sleep(5)
        runs = workflow.get_runs(event="workflow_dispatch")
        return runs[0].id

    def get_workflow_run(self, run_id: int) -> dict:
        """Get workflow run status and logs."""
        run = self._repo.get_workflow_run(run_id)
        return {
            "status": run.status,
            "conclusion": run.conclusion,
            "html_url": run.html_url,
        }

    def append_to_document(self, path: str, entry: str) -> str:
        """Append an entry to a markdown document via branch + PR."""
        ensure_document_path_allowed(path)

        base_branch = "main"
        file = self._repo.get_contents(path, ref=base_branch)
        current = file.decoded_content.decode("utf-8")

        # Append with timestamp
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        new_content = current.rstrip() + f"\n\n### {timestamp}\n{entry}\n"

        # Create a dedicated memory update branch from main.
        branch_suffix = uuid4().hex[:8]
        slug = Path(path).stem.lower().replace("_", "-")
        branch = (
            "memory/"
            f"{slug}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
            f"-{branch_suffix}"
        )
        main_ref = self._repo.get_git_ref(f"heads/{base_branch}")
        self._repo.create_git_ref(
            ref=f"refs/heads/{branch}", sha=main_ref.object.sha
        )

        self._repo.update_file(
            path=path,
            message=f"memory: update {path.split('/')[-1]}",
            content=new_content,
            sha=file.sha,
            branch=branch,
        )

        pr = self._repo.create_pull(
            title=f"memory: update {Path(path).name}",
            body=(
                "Automated durable memory update.\n\n"
                f"Source document: `{path}`\n\n"
                f"Entry:\n\n{entry}"
            ),
            head=branch,
            base=base_branch,
        )
        return f"Memory PR #{pr.number} created: {pr.html_url}"

    MAX_MEMORY_ENTRIES = 100

    def prune_memory_document(self, path: str) -> None:
        """Keep only the last MAX_MEMORY_ENTRIES entries."""
        ensure_document_path_allowed(path)
        base_branch = "main"
        file = self._repo.get_contents(path, ref=base_branch)
        content = file.decoded_content.decode("utf-8")

        # Split on ### headers (each entry starts with ### timestamp)
        sections = content.split("\n### ")
        header = sections[0]  # Everything before the first entry
        entries = sections[1:] if len(sections) > 1 else []

        if len(entries) <= self.MAX_MEMORY_ENTRIES:
            return  # No pruning needed

        # Keep the most recent entries
        kept = entries[-self.MAX_MEMORY_ENTRIES :]
        pruned_content = header + "\n### " + "\n### ".join(kept)

        branch_suffix = uuid4().hex[:8]
        slug = Path(path).stem.lower().replace("_", "-")
        branch = (
            "memory/"
            f"prune-{slug}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
            f"-{branch_suffix}"
        )
        main_ref = self._repo.get_git_ref(f"heads/{base_branch}")
        self._repo.create_git_ref(
            ref=f"refs/heads/{branch}", sha=main_ref.object.sha
        )

        self._repo.update_file(
            path=path,
            message=(
                f"memory: prune {path.split('/')[-1]} "
                f"to {self.MAX_MEMORY_ENTRIES} entries"
            ),
            content=pruned_content,
            sha=file.sha,
            branch=branch,
        )
        self._repo.create_pull(
            title=f"memory: prune {Path(path).name}",
            body=(
                "Automated durable memory pruning update.\n\n"
                f"Source document: `{path}`\n"
                f"Retained entries: {self.MAX_MEMORY_ENTRIES}"
            ),
            head=branch,
            base=base_branch,
        )
