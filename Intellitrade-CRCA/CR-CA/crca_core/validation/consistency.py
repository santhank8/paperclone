"""Consistency validator: verify kernel output satisfies structural equations.

After any numeric result (e.g. counterfactual), recompute using the kernel and
compare. If mismatch beyond tolerance, report failure (reject or flag).
"""

from __future__ import annotations

from typing import Dict, Optional, Tuple

from crca_core.models.spec import LockedSpec
from crca_core.scm import LinearGaussianSCM

_DEFAULT_TOL = 1e-9


def verify_counterfactual_result(
    locked_spec: LockedSpec,
    factual_observation: Dict[str, float],
    intervention: Dict[str, float],
    counterfactual_result: Dict[str, float],
    *,
    tolerance: float = _DEFAULT_TOL,
) -> Tuple[bool, Optional[str]]:
    """Verify that counterfactual_result satisfies the SCM given factual and intervention.

    Recomputes counterfactual via abduction and prediction; compares with
    counterfactual_result. Returns (True, None) if consistent, (False, error_message) otherwise.

    Args:
        locked_spec: Locked spec with SCM.
        factual_observation: Factual observed values.
        intervention: do-intervention.
        counterfactual_result: Claimed counterfactual outcome (variable -> value).
        tolerance: Numeric tolerance for float comparison.

    Returns:
        (ok, error_message). ok is True if recomputed result matches within tolerance.
    """
    if locked_spec.scm is None:
        return False, "No SCM in spec; cannot verify."
    try:
        scm = LinearGaussianSCM.from_spec(locked_spec.scm)
    except ValueError as e:
        return False, str(e)
    try:
        u = scm.abduce_noise(factual_observation, allow_partial=False)
    except ValueError as e:
        return False, f"Abduction failed: {e}"
    recomputed = scm.predict(u, interventions=intervention)
    for var in scm.variables:
        if var not in counterfactual_result and var not in recomputed:
            continue
        val_claimed = counterfactual_result.get(var)
        val_recomputed = recomputed.get(var)
        if val_claimed is None and val_recomputed is None:
            continue
        if val_claimed is None or val_recomputed is None:
            return False, f"Variable {var}: missing in claimed or recomputed result."
        if abs(float(val_claimed) - float(val_recomputed)) > tolerance:
            return (
                False,
                f"Variable {var}: claimed {val_claimed} != recomputed {val_recomputed} (tolerance {tolerance}).",
            )
    return True, None
