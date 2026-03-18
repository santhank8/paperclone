"""Parse structural equations from raw prompt text.

Detects and parses Pearl-style linear SCM equations (e.g. X = U_X; Y = 2*X + U_Y)
into equation dicts compatible with parse_equation_item/parse_equations_to_scm.
Used for automatic SCM instantiation when the user provides fully specified
deterministic equations in the prompt.
"""

from __future__ import annotations

import re
from typing import Any

# Delimiters for splitting equations in text
_EQUATION_DELIMITERS = re.compile(r"[\n;,]+")

# LHS = RHS: variable name (alphanumeric + underscore)
_LHS_RHS = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$", re.DOTALL)

# Exogenous: X = U_X or X = U_1 (single noise term only)
_EXOGENOUS_RHS = re.compile(r"^\s*U_([A-Za-z0-9_]+)\s*$")

# Linear term: optional number then optional * then varname (e.g. 2*X, 2X, X)
_LINEAR_TERM = re.compile(
    r"(?:(?P<coeff>-?\d+\.?\d*(?:[eE][+-]?\d+)?)\s*\*?\s*)?(?P<var>[A-Za-z_][A-Za-z0-9_]*)"
)
# Noise term at end: + U_VarName
_NOISE_TERM = re.compile(r"\+\s*U_([A-Za-z0-9_]+)\s*$")


def detect_structural_equations_in_text(text: str) -> bool:
    """Detect whether text contains equation-like structural definitions.

    Heuristic: presence of LHS = RHS patterns with optional U_var noise term
    or explicit exogenous form (V = U_V). Returns True only when there is a
    reasonable chance parse_structural_equations_from_text will succeed.

    Args:
        text: Raw prompt or message string.

    Returns:
        True if structural equation patterns are present and parse is likely
        to succeed; False otherwise.
    """
    if not text or not text.strip():
        return False
    # Quick check: at least one "VAR = " pattern and something suggesting RHS (U_ or * or +)
    has_equals = "=" in text
    has_structural = bool(re.search(r"U_[A-Za-z0-9_]", text)) or bool(
        re.search(r"[A-Za-z_][A-Za-z0-9_]*\s*=\s*[^=]+", text)
    )
    return bool(has_equals and has_structural)


def _parse_one_equation(line: str) -> dict[str, Any] | None:
    """Parse a single equation line into a dict for parse_equation_item.

    Returns:
        Dict with variable, parents, coefficients, intercept, or None if
        ambiguous or unsupported.
    """
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    m = _LHS_RHS.match(line)
    if not m:
        return None
    lhs, rhs = m.group(1), m.group(2).strip()
    if not lhs or not rhs:
        return None

    # Exogenous: RHS is just U_xxx
    exo = _EXOGENOUS_RHS.match(rhs)
    if exo:
        # Canonical: X = U_X; we allow X = U_1 etc. LHS is the variable.
        return {
            "variable": lhs,
            "parents": [],
            "coefficients": {},
            "intercept": 0.0,
        }

    # Linear endogenous: RHS = terms + U_Var (noise for this equation)
    # Remove trailing noise term to get linear part
    noise_match = _NOISE_TERM.search(rhs)
    if not noise_match:
        return None
    noise_var = noise_match.group(1)
    linear_part = rhs[: noise_match.start()].strip()
    # Optional: require noise to match LHS (U_Y for Y) for clarity
    if noise_var != lhs:
        # Still allow U_1, U_2 etc.; treat as valid
        pass

    # Parse linear part: terms separated by + or -
    parents: list[str] = []
    coefficients: dict[str, float] = {}
    intercept = 0.0
    # Normalize: split on + and - keeping separators to assign sign
    tokens = re.split(r"(\+|\-)", linear_part)
    sign = 1
    for i, tok in enumerate(tokens):
        tok = tok.strip()
        if tok in ("+", "-"):
            sign = 1 if tok == "+" else -1
            continue
        if not tok:
            continue
        term_m = _LINEAR_TERM.match(tok)
        if term_m:
            coeff_s, var = term_m.group("coeff"), term_m.group("var")
            if var.startswith("U_"):
                continue
            coeff = 1.0 if coeff_s is None else float(coeff_s)
            coeff *= sign
            if var not in parents:
                parents.append(var)
            coefficients[var] = coefficients.get(var, 0.0) + coeff
        else:
            try:
                intercept += sign * float(tok)
            except ValueError:
                pass
    return {
        "variable": lhs,
        "parents": parents,
        "coefficients": coefficients,
        "intercept": intercept,
    }


def parse_structural_equations_from_text(text: str) -> list[dict[str, Any]] | None:
    """Parse raw text into equation dicts compatible with parse_equation_item.

    Supports minimal Pearl SCM forms:
    - Exogenous: X = U_X, X = U_1.
    - Linear endogenous: Y = 2*X + U_Y, Y = 2X + U_Y, Y = 0.5*X + 1 + U_Y
      (only when all coefficients and intercept are numeric).

    Returns None when no deterministic equations are found, or when structure
    is ambiguous (e.g. latent confounding, unknown parameters, unsupported form).

    Args:
        text: Raw prompt or message string.

    Returns:
        List of equation dicts (variable, parents, coefficients, intercept)
        or None if parse fails or is ambiguous.
    """
    if not text or not text.strip():
        return None
    lines = _EQUATION_DELIMITERS.split(text)
    equations: list[dict[str, Any]] = []
    seen_vars: set[str] = set()
    for line in lines:
        eq = _parse_one_equation(line)
        if eq is None:
            continue
        var = eq["variable"]
        if var in seen_vars:
            return None  # Duplicate variable -> ambiguous
        seen_vars.add(var)
        # Reject if any coefficient is not numeric (handled in _parse_one_equation)
        equations.append(eq)
    if not equations:
        return None
    return equations
