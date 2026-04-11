"""Test tool definitions and schema for LLM-backed Scrum Master.

Spec ref: Phase 2 ACTION_SPEC — Track F
"""

import pytest

from src.nodes.scrum_master import TOOLS, SYSTEM_PROMPT


class TestScrumMasterToolSchemas:
    """Verify tool definitions have correct structure."""

    def test_all_tools_have_required_fields(self) -> None:
        for tool in TOOLS:
            assert "name" in tool, f"Tool missing 'name': {tool}"
            assert "description" in tool, f"Tool {tool.get('name')} missing 'description'"
            assert "input_schema" in tool, f"Tool {tool['name']} missing 'input_schema'"
            assert tool["input_schema"]["type"] == "object", (
                f"Tool {tool['name']} input_schema type must be 'object'"
            )

    def test_tool_count(self) -> None:
        """Phase 2 requires at least 9 tools (8 original + append_to_memory)."""
        assert len(TOOLS) >= 9

    def test_merge_tool_supports_autonomous_merging(self) -> None:
        """merge_pr tool should allow autonomous merge when PR is ready."""
        merge_tool = next(t for t in TOOLS if t["name"] == "merge_pr")
        assert "autonomous" in merge_tool["description"].lower()

    def test_dispatch_to_test_lead_tool_exists(self) -> None:
        """Phase 2 requires dispatch_to_test_lead tool."""
        tool_names = [t["name"] for t in TOOLS]
        assert "dispatch_to_test_lead" in tool_names

    def test_append_to_memory_tool_exists(self) -> None:
        """Phase 2 requires append_to_memory tool."""
        tool_names = [t["name"] for t in TOOLS]
        assert "append_to_memory" in tool_names

    def test_append_to_memory_has_document_enum(self) -> None:
        """append_to_memory must accept LESSONS_LEARNED and AGENT_MEMORY."""
        memory_tool = next(t for t in TOOLS if t["name"] == "append_to_memory")
        doc_prop = memory_tool["input_schema"]["properties"]["document"]
        assert "LESSONS_LEARNED" in doc_prop["enum"]
        assert "AGENT_MEMORY" in doc_prop["enum"]

    def test_dispatch_to_infra_lead_tool_exists(self) -> None:
        """TRA-91: SM must have dispatch_to_infra_lead in tool list."""
        tool = next(t for t in TOOLS if t["name"] == "dispatch_to_infra_lead")
        assert "query" in str(tool["input_schema"])
        assert tool["input_schema"]["properties"]["query"]["type"] == "string"
        assert "query" in tool["input_schema"]["required"]

    def test_all_tools_have_descriptions(self) -> None:
        """Every tool description must be non-empty."""
        for tool in TOOLS:
            assert len(tool["description"]) > 10, (
                f"Tool {tool['name']} has too short a description"
            )

    def test_required_tools_present(self) -> None:
        """All required tools are defined."""
        required = {
            "get_open_issues",
            "get_issue_details",
            "assign_issue",
            "dispatch_to_code_operator",
            "dispatch_to_test_lead",
            "merge_pr",
            "close_issue",
            "get_pr_status",
            "post_to_slack",
            "append_to_memory",
            "approve_merge",
            "create_github_issue",
        }
        actual = {t["name"] for t in TOOLS}
        missing = required - actual
        assert not missing, f"Missing tools: {missing}"


class TestScrumMasterSystemPrompt:
    """Verify system prompt structure."""

    def test_system_prompt_has_placeholders(self) -> None:
        """System prompt must have format placeholders for state injection."""
        assert "{workflow_stage}" in SYSTEM_PROMPT
        assert "{current_issue_number}" in SYSTEM_PROMPT
        assert "{pr_number}" in SYSTEM_PROMPT
        assert "{retry_count}" in SYSTEM_PROMPT
        assert "{max_retries}" in SYSTEM_PROMPT
        assert "{merge_gate_block}" in SYSTEM_PROMPT

    def test_system_prompt_has_rules(self) -> None:
        """System prompt must include safety rules."""
        assert "NEVER" in SYSTEM_PROMPT
        assert "merge" in SYSTEM_PROMPT.lower()
        assert "human" in SYSTEM_PROMPT.lower()

    def test_system_prompt_has_dispatch_behavior_rules(self) -> None:
        """IR-001 Fix 1: SM prompt must include dispatch behavior rules."""
        assert "Dispatch Behavior Rules" in SYSTEM_PROMPT
        assert "do NOT post" in SYSTEM_PROMPT
        assert "ACTUAL findings" in SYSTEM_PROMPT
        assert "contact DevOps" in SYSTEM_PROMPT
        assert "would you like me to escalate" in SYSTEM_PROMPT
