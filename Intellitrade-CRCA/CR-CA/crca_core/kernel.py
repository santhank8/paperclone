"""Deterministic structural kernel for time-step propagation.

All numeric propagation must use these functions (or LinearGaussianSCM.predict);
coefficients must come from the registry, never from LLM output. LLM never
allowed to output G_t directly—only the kernel computes time evolution.
"""

from __future__ import annotations


def propagate_g(
    a: float,
    b: float,
    G_prev: float,
    R_prev: float,
    *,
    intercept: float = 0.0,
) -> float:
    """One-step recurrence: G_t = intercept + a * G_prev + b * R_prev.

    Pure deterministic function for temporal structural equations. Use for
    time-step propagation; coefficients (a, b) must come from the coefficient
    registry.

    Args:
        a: Coefficient on G_prev.
        b: Coefficient on R_prev.
        G_prev: Previous value of G.
        R_prev: Previous value of R.
        intercept: Optional intercept (default 0).

    Returns:
        G_t = intercept + a*G_prev + b*R_prev.
    """
    return float(intercept + a * float(G_prev) + b * float(R_prev))


def propagate_linear(
    coefficients: dict[str, float],
    parent_values: dict[str, float],
    *,
    intercept: float = 0.0,
) -> float:
    """Single endogenous variable: value = intercept + sum(coeff[p] * parent_values[p]).

    Does not add noise; for deterministic structural step. Noise (U) is applied
    externally (e.g. in abduce-then-predict). Coefficients must come from registry.

    Args:
        coefficients: Parent name -> coefficient.
        parent_values: Parent name -> value.
        intercept: Intercept.

    Returns:
        intercept + sum(coefficients[p] * parent_values[p] for p in coefficients).
    """
    out = float(intercept)
    for p, beta in coefficients.items():
        if p in parent_values:
            out += beta * float(parent_values[p])
    return out
