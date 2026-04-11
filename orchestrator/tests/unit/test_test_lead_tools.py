"""Test tool definitions for Test Lead.

Spec ref: Phase 2 ACTION_SPEC — Track F
"""

import pytest

from src.nodes.test_lead import (
    TOOLS as TEST_LEAD_TOOLS,
    SYSTEM_PROMPT,
    _validate_verdict,
)


class TestTestLeadToolSchemas:
    """Verify Test Lead tool definitions."""

    def test_all_tools_have_required_fields(self) -> None:
        for tool in TEST_LEAD_TOOLS:
            assert "name" in tool
            assert "description" in tool
            assert "input_schema" in tool
            assert tool["input_schema"]["type"] == "object"

    def test_tool_count(self) -> None:
        """Test Lead requires 6 tools."""
        assert len(TEST_LEAD_TOOLS) >= 6

    def test_test_lead_has_verdict_tool(self) -> None:
        """submit_verdict must support PASS and FAIL verdicts."""
        verdict_tool = next(
            t for t in TEST_LEAD_TOOLS if t["name"] == "submit_verdict"
        )
        schema_str = str(verdict_tool["input_schema"])
        assert "PASS" in schema_str
        assert "FAIL" in schema_str

    def test_test_lead_has_workflow_trigger(self) -> None:
        """trigger_test_workflow must accept pr_number."""
        trigger_tool = next(
            t for t in TEST_LEAD_TOOLS if t["name"] == "trigger_test_workflow"
        )
        schema_str = str(trigger_tool["input_schema"])
        assert "pr_number" in schema_str

    def test_test_lead_has_diff_tool(self) -> None:
        """get_pr_diff must exist for AC analysis."""
        tool_names = [t["name"] for t in TEST_LEAD_TOOLS]
        assert "get_pr_diff" in tool_names

    def test_test_lead_has_file_contents_tool(self) -> None:
        """get_file_contents must exist for deeper analysis."""
        tool_names = [t["name"] for t in TEST_LEAD_TOOLS]
        assert "get_file_contents" in tool_names

    def test_test_lead_has_ac_tool(self) -> None:
        """get_issue_acceptance_criteria must exist."""
        tool_names = [t["name"] for t in TEST_LEAD_TOOLS]
        assert "get_issue_acceptance_criteria" in tool_names

    def test_required_tools_present(self) -> None:
        """All required tools for Test Lead are defined."""
        required = {
            "get_pr_diff",
            "get_issue_acceptance_criteria",
            "get_file_contents",
            "trigger_test_workflow",
            "get_workflow_results",
            "submit_verdict",
        }
        actual = {t["name"] for t in TEST_LEAD_TOOLS}
        missing = required - actual
        assert not missing, f"Missing tools: {missing}"


class TestTestLeadSystemPrompt:
    """Verify Test Lead system prompt structure."""

    def test_system_prompt_mentions_financial_invariants(self) -> None:
        """System prompt must reference P1-P4 invariants."""
        assert "P1" in SYSTEM_PROMPT
        assert "P2" in SYSTEM_PROMPT
        assert "P3" in SYSTEM_PROMPT
        assert "P4" in SYSTEM_PROMPT

    def test_system_prompt_mentions_validation_layers(self) -> None:
        """System prompt must describe semantic, mechanical, and invariant checks."""
        assert "SEMANTIC" in SYSTEM_PROMPT
        assert "MECHANICAL" in SYSTEM_PROMPT
        assert "FINANCIAL INVARIANTS" in SYSTEM_PROMPT

    def test_system_prompt_has_placeholders(self) -> None:
        """System prompt must have format placeholders."""
        assert "{pr_number}" in SYSTEM_PROMPT
        assert "{issue_number}" in SYSTEM_PROMPT

    def test_system_prompt_has_verdict_rules(self) -> None:
        """System prompt must describe verdict requirements."""
        assert "submit_verdict" in SYSTEM_PROMPT
        assert "NEVER approve" in SYSTEM_PROMPT

    def test_system_prompt_mentions_submit_verdict(self) -> None:
        """System prompt must reference submit_verdict tool."""
        assert "submit_verdict" in SYSTEM_PROMPT


class TestVerdictValidation:
    """Tests for _validate_verdict schema enforcement."""

    def _valid_verdict(self, **overrides) -> dict:
        """Build a valid verdict input, with optional overrides."""
        base = {
            "pr_number": 99,
            "verdict": "PASS",
            "criteria": [
                {
                    "criterion": "Adds widget endpoint",
                    "status": "COVERED",
                    "evidence": "src/api.py:42",
                }
            ],
            "test_results": {
                "conclusion": "success",
                "summary": "12 passed",
            },
            "invariant_findings": [],
            "failure_report": "",
        }
        base.update(overrides)
        return base

    def test_valid_pass_verdict_returns_none(self) -> None:
        assert _validate_verdict(self._valid_verdict()) is None

    def test_valid_fail_verdict_with_report_returns_none(self) -> None:
        v = self._valid_verdict(
            verdict="FAIL",
            failure_report="test_widget fails: missing endpoint handler",
        )
        assert _validate_verdict(v) is None

    def test_invalid_verdict_value_rejected(self) -> None:
        err = _validate_verdict(self._valid_verdict(verdict="MAYBE"))
        assert err is not None
        assert "verdict" in err.lower() or "MAYBE" in err

    def test_criteria_must_be_list(self) -> None:
        err = _validate_verdict(self._valid_verdict(criteria="not a list"))
        assert err is not None
        assert "criteria" in err.lower()

    def test_criterion_missing_required_field(self) -> None:
        err = _validate_verdict(
            self._valid_verdict(criteria=[{"criterion": "X", "status": "COVERED"}])
        )
        assert err is not None
        assert "evidence" in err

    def test_criterion_invalid_status(self) -> None:
        err = _validate_verdict(
            self._valid_verdict(
                criteria=[
                    {
                        "criterion": "X",
                        "status": "UNKNOWN",
                        "evidence": "file.py:1",
                    }
                ]
            )
        )
        assert err is not None
        assert "status" in err.lower()

    def test_test_results_must_be_dict(self) -> None:
        err = _validate_verdict(self._valid_verdict(test_results="string"))
        assert err is not None
        assert "test_results" in err.lower()

    def test_test_results_missing_conclusion(self) -> None:
        err = _validate_verdict(
            self._valid_verdict(test_results={"summary": "ok"})
        )
        assert err is not None
        assert "conclusion" in err

    def test_invariant_findings_must_be_list(self) -> None:
        err = _validate_verdict(
            self._valid_verdict(invariant_findings="not a list")
        )
        assert err is not None
        assert "invariant" in err.lower()

    def test_fail_verdict_requires_failure_report(self) -> None:
        err = _validate_verdict(
            self._valid_verdict(verdict="FAIL", failure_report="")
        )
        assert err is not None
        assert "failure_report" in err

    def test_pass_verdict_allows_empty_failure_report(self) -> None:
        assert _validate_verdict(self._valid_verdict(failure_report="")) is None
