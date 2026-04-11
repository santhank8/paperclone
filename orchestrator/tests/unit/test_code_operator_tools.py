"""Test tool definitions for LLM-backed Code Operator.

Spec ref: Phase 2 ACTION_SPEC — Track F
"""

import pytest

from src.nodes.code_operator import TOOLS, SYSTEM_PROMPT


class TestCodeOperatorToolSchemas:
    """Verify Code Operator tool definitions."""

    def test_all_tools_have_required_fields(self) -> None:
        for tool in TOOLS:
            assert "name" in tool
            assert "description" in tool
            assert "input_schema" in tool
            assert tool["input_schema"]["type"] == "object"

    def test_tool_count(self) -> None:
        """Code Operator requires 5 tools."""
        assert len(TOOLS) >= 5

    def test_dispatch_tool_has_retry_context(self) -> None:
        """dispatch_claude_code_job should accept retry_context."""
        dispatch_tool = next(
            t for t in TOOLS if t["name"] == "dispatch_claude_code_job"
        )
        props = dispatch_tool["input_schema"]["properties"]
        assert "retry_context" in props

    def test_dispatch_tool_requires_issue_number_and_body(self) -> None:
        """dispatch_claude_code_job must require issue_number and issue_body."""
        dispatch_tool = next(
            t for t in TOOLS if t["name"] == "dispatch_claude_code_job"
        )
        required = dispatch_tool["input_schema"]["required"]
        assert "issue_number" in required
        assert "issue_body" in required

    def test_poll_job_to_completion_tool_exists(self) -> None:
        tool_names = [t["name"] for t in TOOLS]
        assert "poll_job_to_completion" in tool_names

    def test_find_pr_tool_exists(self) -> None:
        tool_names = [t["name"] for t in TOOLS]
        assert "find_pr_for_branch" in tool_names

    def test_create_pr_tool_exists(self) -> None:
        tool_names = [t["name"] for t in TOOLS]
        assert "create_pr" in tool_names

    def test_get_pr_diff_tool_exists(self) -> None:
        tool_names = [t["name"] for t in TOOLS]
        assert "get_pr_diff" in tool_names

    def test_required_tools_present(self) -> None:
        """All required tools for Code Operator are defined."""
        required = {
            "dispatch_claude_code_job",
            "poll_job_to_completion",
            "find_pr_for_branch",
            "create_pr",
            "get_pr_diff",
        }
        actual = {t["name"] for t in TOOLS}
        missing = required - actual
        assert not missing, f"Missing tools: {missing}"


class TestCodeOperatorSystemPrompt:
    """Verify Code Operator system prompt structure."""

    def test_system_prompt_has_placeholders(self) -> None:
        assert "{issue_number}" in SYSTEM_PROMPT
        assert "{retry_count}" in SYSTEM_PROMPT
        assert "{max_retries}" in SYSTEM_PROMPT
        assert "{test_failure_report}" in SYSTEM_PROMPT

    def test_system_prompt_mentions_retry(self) -> None:
        assert "retry" in SYSTEM_PROMPT.lower()

    def test_system_prompt_mentions_pr(self) -> None:
        assert "PR" in SYSTEM_PROMPT
