"""Tests for ClarificationMiddleware string-serialized options coercion."""

from deerflow.agents.middlewares.clarification_middleware import ClarificationMiddleware


class TestFormatClarification:
    def _middleware(self):
        return ClarificationMiddleware()

    def test_list_options_unchanged(self):
        mw = self._middleware()
        msg = mw._format_clarification_message({
            "question": "Which language?",
            "options": ["Python", "Ruby", "Go"],
        })
        assert "1. Python" in msg
        assert "2. Ruby" in msg
        assert "3. Go" in msg

    def test_string_json_array_coerced(self):
        """LLM sometimes returns options as a JSON string instead of a list."""
        mw = self._middleware()
        msg = mw._format_clarification_message({
            "question": "Which language?",
            "options": '["Python", "Ruby", "Go"]',
        })
        assert "1. Python" in msg
        assert "2. Ruby" in msg

    def test_plain_string_becomes_single_option(self):
        """If it's a plain string (not JSON), treat it as a single option."""
        mw = self._middleware()
        msg = mw._format_clarification_message({
            "question": "Which?",
            "options": "just one option",
        })
        assert "1. just one option" in msg

    def test_empty_options_no_crash(self):
        mw = self._middleware()
        msg = mw._format_clarification_message({
            "question": "Question?",
            "options": [],
        })
        assert "Question?" in msg

    def test_empty_string_no_crash(self):
        mw = self._middleware()
        msg = mw._format_clarification_message({
            "question": "Question?",
            "options": "",
        })
        # Empty string -> no options displayed
        assert "Question?" in msg
