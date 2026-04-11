"""Linear API client — sync story lifecycle events to Linear.

Spec ref: AgenticSquad_Functional_Spec v3.0 §10.3
TRA-26: Linear sync integration

Uses the Linear REST/GraphQL API directly for create/update operations.
Degrades gracefully on transient failures (log + continue, never crash the workflow).
"""

from __future__ import annotations

import json
import logging
import os
import urllib.request
import urllib.error
from typing import Any, Optional

logger = logging.getLogger(__name__)

LINEAR_API_URL = "https://api.linear.app/graphql"

# Linear status name → Linear workflow state mapping
# These map to typical Linear workflow states; actual state IDs
# are resolved at runtime via the API.
STATUS_MAP: dict[str, str] = {
    "story_picked_up": "In Progress",
    "pr_created": "In Progress",
    "story_merged": "In Review",
    "deploy_verified": "Done",
    "escalation": "Blocked",
}

# Event → comment prefix for Linear comments
COMMENT_PREFIX: dict[str, str] = {
    "pr_created": "PR Created",
    "architect_review": "Architect Review",
    "test_result": "Test Result",
    "escalation": "Escalation",
    "deploy_verified": "Deploy Verified",
}


class LinearClient:
    """Thin wrapper around Linear GraphQL API for story lifecycle sync."""

    def __init__(self, api_token: str | None = None) -> None:
        self._token = api_token or os.environ.get("LINEAR_API_TOKEN", "")
        if not self._token:
            logger.warning(
                "LINEAR_API_TOKEN not set — Linear sync will be disabled"
            )
        self._team_id: str | None = None
        self._workflow_states: dict[str, str] = {}

    @property
    def enabled(self) -> bool:
        return bool(self._token)

    def _graphql(self, query: str, variables: dict | None = None) -> dict:
        """Execute a Linear GraphQL query/mutation."""
        if not self._token:
            raise RuntimeError("Linear API token not configured")

        payload = json.dumps(
            {"query": query, "variables": variables or {}}
        ).encode()
        req = urllib.request.Request(
            LINEAR_API_URL,
            data=payload,
            headers={
                "Authorization": self._token,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode() if e.fp else ""
            logger.error(f"Linear API error {e.code}: {body[:500]}")
            raise
        except urllib.error.URLError as e:
            logger.error(f"Linear API connection error: {e}")
            raise

    def _ensure_team_id(self) -> str:
        """Resolve the team ID (cached after first call)."""
        if self._team_id:
            return self._team_id
        result = self._graphql("{ teams { nodes { id name } } }")
        teams = result.get("data", {}).get("teams", {}).get("nodes", [])
        if not teams:
            raise RuntimeError("No Linear teams found")
        self._team_id = teams[0]["id"]
        return self._team_id

    def _ensure_workflow_states(self) -> dict[str, str]:
        """Resolve workflow state name → ID mapping (cached)."""
        if self._workflow_states:
            return self._workflow_states
        team_id = self._ensure_team_id()
        result = self._graphql(
            """query($teamId: String!) {
                workflowStates(filter: { team: { id: { eq: $teamId } } }) {
                    nodes { id name }
                }
            }""",
            {"teamId": team_id},
        )
        states = (
            result.get("data", {})
            .get("workflowStates", {})
            .get("nodes", [])
        )
        self._workflow_states = {s["name"]: s["id"] for s in states}
        return self._workflow_states

    def find_issue_by_identifier(self, identifier: str) -> Optional[dict]:
        """Find a Linear issue by its identifier (e.g., 'TRA-25')."""
        result = self._graphql(
            """query($filter: IssueFilter) {
                issues(filter: $filter, first: 1) {
                    nodes { id identifier title state { name } }
                }
            }""",
            {"filter": {"identifier": {"eq": identifier}}},
        )
        nodes = result.get("data", {}).get("issues", {}).get("nodes", [])
        return nodes[0] if nodes else None

    def update_issue_status(
        self, issue_id: str, status_name: str
    ) -> dict:
        """Update a Linear issue's workflow state by status name."""
        states = self._ensure_workflow_states()
        state_id = states.get(status_name)
        if not state_id:
            logger.warning(
                f"Linear workflow state '{status_name}' not found. "
                f"Available: {list(states.keys())}"
            )
            return {}
        return self._graphql(
            """mutation($id: String!, $stateId: String!) {
                issueUpdate(id: $id, input: { stateId: $stateId }) {
                    success
                    issue { id identifier state { name } }
                }
            }""",
            {"id": issue_id, "stateId": state_id},
        )

    def add_comment(self, issue_id: str, body: str) -> dict:
        """Add a comment to a Linear issue."""
        return self._graphql(
            """mutation($issueId: String!, $body: String!) {
                commentCreate(input: { issueId: $issueId, body: $body }) {
                    success
                    comment { id }
                }
            }""",
            {"issueId": issue_id, "body": body},
        )

    def create_issue(
        self,
        title: str,
        description: str,
        labels: list[str] | None = None,
    ) -> dict:
        """Create a new Linear issue."""
        team_id = self._ensure_team_id()
        return self._graphql(
            """mutation($teamId: String!, $title: String!, $description: String) {
                issueCreate(input: {
                    teamId: $teamId,
                    title: $title,
                    description: $description
                }) {
                    success
                    issue { id identifier title url }
                }
            }""",
            {
                "teamId": team_id,
                "title": title,
                "description": description,
            },
        )

    def get_priority_ordered_issues(
        self, status: str = "In Progress"
    ) -> list[dict]:
        """Get issues ordered by priority for story pickup.

        Returns issues sorted by Linear priority (1=urgent, 4=low, 0=none).
        """
        team_id = self._ensure_team_id()
        result = self._graphql(
            """query($teamId: String!, $status: String!) {
                issues(
                    filter: {
                        team: { id: { eq: $teamId } },
                        state: { name: { eq: $status } }
                    },
                    orderBy: priority,
                    first: 20
                ) {
                    nodes {
                        id identifier title priority
                        state { name }
                        labels { nodes { name } }
                    }
                }
            }""",
            {"teamId": team_id, "status": status},
        )
        return (
            result.get("data", {}).get("issues", {}).get("nodes", [])
        )

    def sync_lifecycle_event(
        self,
        event: str,
        issue_identifier: str,
        details: str = "",
    ) -> bool:
        """Sync a story lifecycle event to Linear.

        Returns True if sync succeeded, False on failure (graceful degradation).
        """
        if not self.enabled:
            logger.info(f"Linear sync disabled — skipping {event}")
            return False

        try:
            issue = self.find_issue_by_identifier(issue_identifier)
            if not issue:
                logger.warning(
                    f"Linear issue {issue_identifier} not found — skipping sync"
                )
                return False

            issue_id = issue["id"]

            # Update status if this event maps to a status change
            new_status = STATUS_MAP.get(event)
            if new_status:
                self.update_issue_status(issue_id, new_status)
                logger.info(
                    f"Linear {issue_identifier}: status → {new_status}"
                )

            # Add comment if this event has comment content
            prefix = COMMENT_PREFIX.get(event)
            if prefix and details:
                comment_body = f"**{prefix}**\n\n{details}"
                self.add_comment(issue_id, comment_body)
                logger.info(
                    f"Linear {issue_identifier}: comment added ({prefix})"
                )

            return True

        except Exception:
            # TRA-26 constraint: Linear sync must not block the workflow
            logger.exception(
                f"Linear sync failed for {event} on {issue_identifier} — "
                "continuing workflow"
            )
            return False

    def sync_lifecycle_event_safe(
        self,
        event: str,
        issue_identifier: str,
        details: str = "",
        retry: bool = True,
    ) -> bool:
        """Sync with one retry on transient failure."""
        success = self.sync_lifecycle_event(event, issue_identifier, details)
        if not success and retry:
            logger.info(f"Retrying Linear sync for {event}")
            success = self.sync_lifecycle_event(
                event, issue_identifier, details
            )
        return success
