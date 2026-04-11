"""Unit tests for SDLCState dataclass.

Spec ref: AgenticSquad_Functional_Spec v2.8 RC §10
"""

from src.state import SDLCState


def test_default_state_is_idle() -> None:
    state = SDLCState()
    assert state.workflow_stage == "idle"
    assert state.current_issue_number is None
    assert state.retry_count == 0
    assert state.max_retries == 3
    assert state.pr_risk_tier == "normal"
    assert state.pr_changed_files == []
    assert state.architect_review_passed is None
    assert state.test_workflow_run_ids == []


def test_state_with_issue() -> None:
    state = SDLCState(
        current_issue_number=42,
        current_issue_body="Fix the bug",
        workflow_stage="idle",
    )
    assert state.current_issue_number == 42
    assert state.current_issue_body == "Fix the bug"


def test_state_mutable_lists_independent() -> None:
    """Each state instance should have independent mutable fields."""
    s1 = SDLCState()
    s2 = SDLCState()
    s1.current_issue_labels.append("bug")
    assert s2.current_issue_labels == []


def test_state_cost_tracker_defaults_to_empty() -> None:
    state = SDLCState()
    assert state.cost_tracker == {}


def test_state_error_context_defaults_to_empty() -> None:
    state = SDLCState()
    assert state.error_context == {}


def test_state_replace_preserves_fields() -> None:
    from dataclasses import replace

    original = SDLCState(
        current_issue_number=42,
        workflow_stage="idle",
        retry_count=1,
    )
    updated = replace(original, workflow_stage="dispatch_coding")
    assert updated.workflow_stage == "dispatch_coding"
    assert updated.current_issue_number == 42
    assert updated.retry_count == 1
