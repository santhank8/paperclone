"""Tests for the lead agent system prompt template.

These tests assert the presence of guidance sections that are easy to lose
during refactors. They are deliberately substring-based rather than format
assertions so they survive cosmetic edits while still catching deletions.
"""

from __future__ import annotations

from deerflow.agents.lead_agent.prompt import SYSTEM_PROMPT_TEMPLATE, apply_prompt_template


def test_system_prompt_template_includes_file_handling_section():
    assert "<file_and_tool_handling>" in SYSTEM_PROMPT_TEMPLATE
    assert "</file_and_tool_handling>" in SYSTEM_PROMPT_TEMPLATE


def test_system_prompt_template_warns_about_large_file_reads():
    # The agent must be told to use start_line/end_line for files >50 KB —
    # without this, it will read entire crash dumps / logs and blow context.
    assert "start_line" in SYSTEM_PROMPT_TEMPLATE
    assert "end_line" in SYSTEM_PROMPT_TEMPLATE
    assert "50 KB" in SYSTEM_PROMPT_TEMPLATE


def test_system_prompt_template_documents_tool_description_requirement():
    # Every sandbox tool requires `description` as the first parameter; small
    # models tend to omit it and then loop on validation errors.
    assert "description" in SYSTEM_PROMPT_TEMPLATE
    assert "FIRST argument" in SYSTEM_PROMPT_TEMPLATE


def test_system_prompt_template_warns_about_unbounded_parallel_reads():
    # Parallel reads on files of unknown size are how we hit the 65 K context
    # cap on VIB-20 v1 — the agent fired three 170 KB read_file calls in
    # parallel and the combined tool results overflowed.
    assert "serially" in SYSTEM_PROMPT_TEMPLATE


def test_apply_prompt_template_renders_file_handling_section():
    rendered = apply_prompt_template(subagent_enabled=False)
    assert "<file_and_tool_handling>" in rendered
    assert "start_line" in rendered
    # Critical reminder bullet should also surface the rule for fast scanning.
    assert "Large Files" in rendered
    assert "Tool Schema" in rendered


def test_apply_prompt_template_renders_with_subagents_enabled():
    rendered = apply_prompt_template(subagent_enabled=True, max_concurrent_subagents=3)
    # File handling guidance must survive both subagent on/off paths.
    assert "<file_and_tool_handling>" in rendered
    assert "start_line" in rendered
