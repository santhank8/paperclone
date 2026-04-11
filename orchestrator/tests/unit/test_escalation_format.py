"""Tests for structured escalation formatting (TRA-62).

Min 5 tests required per spec.
"""

from src.tools.slack_client import (
    ErrorCategory,
    classify_error,
    format_escalation,
)


class TestErrorCategory:
    def test_all_categories_exist(self) -> None:
        assert ErrorCategory.LLM_FAILURE == "LLM_FAILURE"
        assert ErrorCategory.API_FAILURE == "API_FAILURE"
        assert ErrorCategory.TIMEOUT == "TIMEOUT"
        assert ErrorCategory.PERMISSION_DENIED == "PERMISSION_DENIED"
        assert ErrorCategory.UNKNOWN == "UNKNOWN"


class TestClassifyError:
    def test_timeout_error(self) -> None:
        assert classify_error(TimeoutError("timed out")) == ErrorCategory.TIMEOUT

    def test_permission_error(self) -> None:
        assert classify_error(PermissionError("forbidden")) == ErrorCategory.PERMISSION_DENIED

    def test_generic_error_is_unknown(self) -> None:
        assert classify_error(RuntimeError("something")) == ErrorCategory.UNKNOWN

    def test_http_403_classified_as_permission(self) -> None:
        assert classify_error(RuntimeError("403 Forbidden")) == ErrorCategory.PERMISSION_DENIED

    def test_rate_limit_classified_as_api(self) -> None:
        assert classify_error(RuntimeError("rate limit exceeded 429")) == ErrorCategory.API_FAILURE


class TestFormatEscalation:
    def test_full_escalation_message(self) -> None:
        msg = format_escalation(
            story_id="TRA-42",
            story_title="Fix auth bug",
            node_name="code_operator",
            error_category=ErrorCategory.LLM_FAILURE,
            last_action="dispatch_claude_code_job",
            suggested_fix="Retry with lower token count.",
            run_url="https://github.com/runs/123",
        )
        assert "Escalation" in msg
        assert "TRA-42" in msg
        assert "Fix auth bug" in msg
        assert "code_operator" in msg
        assert "LLM_FAILURE" in msg
        assert "dispatch_claude_code_job" in msg
        assert "Retry with lower token count." in msg
        assert "View logs" in msg

    def test_minimal_escalation(self) -> None:
        msg = format_escalation(
            error_category=ErrorCategory.UNKNOWN,
        )
        assert "Escalation" in msg
        assert "UNKNOWN" in msg

    def test_no_raw_traceback_in_output(self) -> None:
        msg = format_escalation(
            story_id="TRA-1",
            node_name="test_lead",
            error_category=ErrorCategory.API_FAILURE,
            last_action="trigger_test_workflow",
            suggested_fix="Check GitHub API rate limits.",
        )
        assert "Traceback" not in msg
        assert "File " not in msg

    def test_story_without_title(self) -> None:
        msg = format_escalation(
            story_id="TRA-10",
            error_category=ErrorCategory.TIMEOUT,
        )
        assert "TRA-10" in msg
        # No title part
        assert " — " not in msg.split("TRA-10")[1].split("\n")[0]

    def test_run_url_omitted_when_empty(self) -> None:
        msg = format_escalation(
            story_id="TRA-5",
            error_category=ErrorCategory.LLM_FAILURE,
        )
        assert "View logs" not in msg
