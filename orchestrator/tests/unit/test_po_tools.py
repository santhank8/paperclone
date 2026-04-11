"""Tests for TRA-25: Product Owner node tools.

Validates PO tool schema, document access enforcement, and deduplication.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from src.nodes.po import TOOLS, SYSTEM_PROMPT


class TestPOToolSchema:
    def test_all_tools_have_required_fields(self) -> None:
        for tool in TOOLS:
            assert "name" in tool, f"Tool missing name"
            assert "description" in tool, f"Tool {tool.get('name')} missing description"
            assert "input_schema" in tool, f"Tool {tool.get('name')} missing input_schema"
            schema = tool["input_schema"]
            assert schema.get("type") == "object"

    def test_fetch_document_requires_path(self) -> None:
        tool = next(t for t in TOOLS if t["name"] == "fetch_document")
        assert "path" in tool["input_schema"]["required"]

    def test_create_github_issue_requires_title_body_labels(self) -> None:
        tool = next(t for t in TOOLS if t["name"] == "create_github_issue")
        required = tool["input_schema"]["required"]
        assert "title" in required
        assert "body" in required
        assert "labels" in required

    def test_tool_names_are_unique(self) -> None:
        names = [t["name"] for t in TOOLS]
        assert len(names) == len(set(names))

    def test_all_expected_tools_present(self) -> None:
        names = {t["name"] for t in TOOLS}
        expected = {
            "fetch_document",
            "get_repo_tree",
            "fetch_existing_issues",
            "create_github_issue",
            "sync_to_linear",
            "post_to_slack",
        }
        assert expected == names


class TestPOSystemPrompt:
    def test_prompt_mentions_archive_prohibition(self) -> None:
        assert "docs/archive/" in SYSTEM_PROMPT

    def test_prompt_mentions_story_size_constraint(self) -> None:
        assert "300" in SYSTEM_PROMPT

    def test_prompt_mentions_user_story_format(self) -> None:
        assert "As a [role]" in SYSTEM_PROMPT

    def test_prompt_mentions_label_taxonomy(self) -> None:
        assert "phase/<n>" in SYSTEM_PROMPT

    def test_prompt_mentions_deduplication(self) -> None:
        assert "duplication" in SYSTEM_PROMPT.lower()
