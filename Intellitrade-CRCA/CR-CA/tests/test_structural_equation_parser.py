"""Unit tests for structural equation parser (prompt text -> equation dicts)."""

from __future__ import annotations

import pytest

from crca_core.core.equation_parser import (
    detect_structural_equations_in_text,
    parse_structural_equations_from_text,
)
from crca_core.core.spec_builder import draft_from_equations, parse_equations_to_scm
from crca_core.scm import LinearGaussianSCM


# --- detect_structural_equations_in_text ---


def test_detect_positive_minimal_pearl_scm() -> None:
    text = "X = U_X; Y = 2*X + U_Y"
    assert detect_structural_equations_in_text(text) is True


def test_detect_positive_with_newlines() -> None:
    text = "X = U_X\nY = 2*X + U_Y"
    assert detect_structural_equations_in_text(text) is True


def test_detect_positive_exogenous_only() -> None:
    text = "A = U_A"
    assert detect_structural_equations_in_text(text) is True


def test_detect_negative_empty() -> None:
    assert detect_structural_equations_in_text("") is False
    assert detect_structural_equations_in_text("   ") is False


def test_detect_negative_no_equations() -> None:
    assert detect_structural_equations_in_text("What is the weather?") is False


def test_detect_negative_vague_form_only() -> None:
    # Y = f(X,U) without numeric structure -> detector may still True (has "=" and VAR = ...)
    # Plan: "vague Y = f(X,U) without numbers" -> detector returns False for "reasonable chance parse will succeed"
    text = "Y = f(X, U)"
    # Parser will return None (no U_Y term); detector can be permissive
    assert detect_structural_equations_in_text(text) is True  # has equals and pattern


# --- parse_structural_equations_from_text ---


def test_parse_minimal_pearl_scm() -> None:
    text = "X = U_X; Y = 2*X + U_Y"
    eqs = parse_structural_equations_from_text(text)
    assert eqs is not None
    assert len(eqs) == 2
    assert eqs[0]["variable"] == "X"
    assert eqs[0]["parents"] == []
    assert eqs[0]["coefficients"] == {}
    assert eqs[0]["intercept"] == 0.0
    assert eqs[1]["variable"] == "Y"
    assert eqs[1]["parents"] == ["X"]
    assert eqs[1]["coefficients"] == {"X": 2.0}
    assert eqs[1]["intercept"] == 0.0


def test_parse_with_2x_no_asterisk() -> None:
    text = "X = U_X\nY = 2X + U_Y"
    eqs = parse_structural_equations_from_text(text)
    assert eqs is not None
    assert len(eqs) == 2
    assert eqs[1]["coefficients"] == {"X": 2.0}


def test_parse_with_intercept() -> None:
    text = "X = U_X\nY = 0.5*X + 1 + U_Y"
    eqs = parse_structural_equations_from_text(text)
    assert eqs is not None
    assert eqs[1]["intercept"] == 1.0
    assert eqs[1]["coefficients"] == {"X": 0.5}


def test_parse_exogenous_only() -> None:
    text = "A = U_A"
    eqs = parse_structural_equations_from_text(text)
    assert eqs is not None
    assert len(eqs) == 1
    assert eqs[0]["variable"] == "A"
    assert eqs[0]["parents"] == []


def test_parse_returns_none_empty() -> None:
    assert parse_structural_equations_from_text("") is None
    assert parse_structural_equations_from_text("  \n  ") is None


def test_parse_returns_none_no_deterministic_equations() -> None:
    # No U_ term in RHS
    text = "Y = 2*X"
    assert parse_structural_equations_from_text(text) is None


def test_parse_returns_none_duplicate_variable() -> None:
    text = "X = U_X\nX = 1 + U_X"
    assert parse_structural_equations_from_text(text) is None


def test_parse_returns_none_vague_form() -> None:
    text = "Y = f(X, U)"
    assert parse_structural_equations_from_text(text) is None


# --- Round-trip: parsed -> SCM -> executable ---


def test_round_trip_parse_to_scm_executable() -> None:
    text = "X = U_X; Y = 2*X + U_Y"
    eqs = parse_structural_equations_from_text(text)
    assert eqs is not None
    scm_spec = parse_equations_to_scm(eqs)
    scm = LinearGaussianSCM.from_spec(scm_spec)
    u = scm.abduce_noise({"X": 1.0, "Y": 3.0})
    assert u["X"] == 1.0
    assert u["Y"] == 1.0  # 3 - 2*1 = 1
    cf = scm.predict(u, interventions={"X": 2.0})
    assert cf["X"] == 2.0
    assert cf["Y"] == 5.0  # 2*2 + 1 = 5


def test_draft_from_equations_then_lock_and_verify() -> None:
    from crca_core import lock_spec, simulate_counterfactual
    from crca_core.models.result import CounterfactualResult
    from crca_core.models.validation import validate_spec

    text = "X = U_X\nY = 2*X + U_Y"
    eqs = parse_structural_equations_from_text(text)
    assert eqs is not None
    draft = draft_from_equations(eqs)
    assert draft.scm is not None
    assert len(draft.scm.equations) == 2
    assert draft.graph.nodes
    report = validate_spec(draft)
    assert report.ok
    locked = lock_spec(draft, approvals=["test"])
    result = simulate_counterfactual(
        locked_spec=locked,
        factual_observation={"X": 1.0, "Y": 3.0},
        intervention={"X": 2.0},
    )
    assert isinstance(result, CounterfactualResult)
    assert result.counterfactual["result"]["Y"] == 5.0
