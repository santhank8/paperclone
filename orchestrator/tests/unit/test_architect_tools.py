"""Unit tests for Architect node tool schemas and outcomes."""

from unittest.mock import MagicMock

import pytest

from src.nodes.architect import TOOLS, _execute_tool
from src.state import SDLCState


class TestArchitectToolSchemas:
    def test_required_tools_present(self) -> None:
        names = {tool["name"] for tool in TOOLS}
        assert "get_pr_diff" in names
        assert "get_issue_context" in names
        assert "submit_architect_review" in names

    def test_submit_tool_has_expected_verdicts(self) -> None:
        submit = next(t for t in TOOLS if t["name"] == "submit_architect_review")
        schema = str(submit["input_schema"])
        assert "APPROVE" in schema
        assert "REQUEST_CHANGES" in schema


@pytest.mark.asyncio
async def test_submit_architect_review_approve_sets_passed_state() -> None:
    github = MagicMock()
    state = SDLCState(pr_number=101, current_issue_number=12)
    result, updates = await _execute_tool(
        "submit_architect_review",
        {
            "pr_number": 101,
            "verdict": "APPROVE",
            "strategic_assessment": "Aligned with current service boundary.",
        },
        github,
        state,
    )
    assert "APPROVE" in result
    assert updates["architect_review_passed"] is True
    assert updates["workflow_stage"] == "architect_passed"
    github.post_pr_review.assert_called_once()


@pytest.mark.asyncio
async def test_submit_architect_review_request_changes_routes_retry() -> None:
    github = MagicMock()
    state = SDLCState(pr_number=101, current_issue_number=12)
    result, updates = await _execute_tool(
        "submit_architect_review",
        {
            "pr_number": 101,
            "verdict": "REQUEST_CHANGES",
            "strategic_assessment": "Introduces cross-service coupling.",
        },
        github,
        state,
    )
    assert "REQUEST_CHANGES" in result
    assert updates["architect_review_passed"] is False
    assert updates["workflow_stage"] == "coding_failed"
    assert "Architect requested changes" in updates["test_failure_report"]
    github.post_pr_review.assert_called_once()
