"""Tests for TRA-26: Linear sync integration.

Validates Linear client behavior including graceful degradation on failures.
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from src.tools.linear_client import LinearClient, STATUS_MAP, COMMENT_PREFIX


class TestLinearClientInit:
    def test_disabled_without_token(self) -> None:
        client = LinearClient(api_token="")
        assert client.enabled is False

    def test_enabled_with_token(self) -> None:
        client = LinearClient(api_token="lin_test_token")
        assert client.enabled is True


class TestLinearStatusMap:
    def test_story_picked_up_maps_to_in_progress(self) -> None:
        assert STATUS_MAP["story_picked_up"] == "In Progress"

    def test_story_merged_maps_to_in_review(self) -> None:
        assert STATUS_MAP["story_merged"] == "In Review"

    def test_deploy_verified_maps_to_done(self) -> None:
        assert STATUS_MAP["deploy_verified"] == "Done"

    def test_escalation_maps_to_blocked(self) -> None:
        assert STATUS_MAP["escalation"] == "Blocked"


class TestLinearCommentPrefix:
    def test_pr_created_has_prefix(self) -> None:
        assert COMMENT_PREFIX["pr_created"] == "PR Created"

    def test_test_result_has_prefix(self) -> None:
        assert COMMENT_PREFIX["test_result"] == "Test Result"


class TestSyncLifecycleEvent:
    def test_disabled_client_returns_false(self) -> None:
        client = LinearClient(api_token="")
        result = client.sync_lifecycle_event(
            "story_picked_up", "TRA-25"
        )
        assert result is False

    @patch.object(LinearClient, "find_issue_by_identifier", return_value=None)
    def test_missing_issue_returns_false(self, mock_find) -> None:
        client = LinearClient(api_token="test_token")
        result = client.sync_lifecycle_event(
            "story_picked_up", "TRA-999"
        )
        assert result is False

    @patch.object(LinearClient, "add_comment", return_value={"data": {}})
    @patch.object(LinearClient, "update_issue_status", return_value={"data": {}})
    @patch.object(
        LinearClient,
        "find_issue_by_identifier",
        return_value={"id": "abc123", "identifier": "TRA-25"},
    )
    def test_successful_sync_returns_true(
        self, mock_find, mock_update, mock_comment
    ) -> None:
        client = LinearClient(api_token="test_token")
        result = client.sync_lifecycle_event(
            "story_picked_up", "TRA-25"
        )
        assert result is True
        mock_update.assert_called_once_with("abc123", "In Progress")

    @patch.object(
        LinearClient,
        "find_issue_by_identifier",
        return_value={"id": "abc123", "identifier": "TRA-25"},
    )
    @patch.object(LinearClient, "update_issue_status", return_value={})
    @patch.object(LinearClient, "add_comment", return_value={})
    def test_pr_created_adds_comment(
        self, mock_comment, mock_update, mock_find
    ) -> None:
        client = LinearClient(api_token="test_token")
        client.sync_lifecycle_event(
            "pr_created", "TRA-25", details="PR #42: https://github.com/..."
        )
        mock_comment.assert_called_once()
        comment_body = mock_comment.call_args[0][1]
        assert "PR Created" in comment_body

    @patch.object(
        LinearClient,
        "find_issue_by_identifier",
        side_effect=Exception("Network error"),
    )
    def test_exception_returns_false_gracefully(self, mock_find) -> None:
        """TRA-26 constraint: sync failure must not crash the workflow."""
        client = LinearClient(api_token="test_token")
        result = client.sync_lifecycle_event(
            "story_picked_up", "TRA-25"
        )
        assert result is False


class TestSyncLifecycleEventSafe:
    @patch.object(
        LinearClient,
        "sync_lifecycle_event",
        side_effect=[False, True],
    )
    def test_retries_once_on_failure(self, mock_sync) -> None:
        client = LinearClient(api_token="test_token")
        result = client.sync_lifecycle_event_safe(
            "story_picked_up", "TRA-25"
        )
        assert result is True
        assert mock_sync.call_count == 2

    @patch.object(
        LinearClient,
        "sync_lifecycle_event",
        return_value=True,
    )
    def test_no_retry_on_success(self, mock_sync) -> None:
        client = LinearClient(api_token="test_token")
        result = client.sync_lifecycle_event_safe(
            "story_picked_up", "TRA-25"
        )
        assert result is True
        assert mock_sync.call_count == 1

    @patch.object(
        LinearClient,
        "sync_lifecycle_event",
        return_value=False,
    )
    def test_no_retry_when_disabled(self, mock_sync) -> None:
        client = LinearClient(api_token="test_token")
        result = client.sync_lifecycle_event_safe(
            "story_picked_up", "TRA-25", retry=False
        )
        assert result is False
        assert mock_sync.call_count == 1
