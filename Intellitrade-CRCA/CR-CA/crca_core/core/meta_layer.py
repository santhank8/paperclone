"""Meta layer: identifiability check, assumptions, refuse/recommend for P(event) and predict-artifact."""

from __future__ import annotations

from typing import List, Literal, Optional

from crca_core.models.result import MetaSummary
from crca_core.models.spec import LockedSpec


def check_identifiability(
    locked_spec: LockedSpec,
    query_type: Literal["p_event", "predict_artifact"],
    *,
    artifact: Optional[str] = None,
    time: Optional[int] = None,
) -> MetaSummary:
    """Check identifiability and return assumptions/caveats. Refuse only via RefusalResult elsewhere."""
    assumptions: List[str] = [
        "Markov assumption (no unobserved confounding across time steps).",
        "SCM structure and parameters are correct.",
        "Observed path (if provided) is consistent with the SCM.",
    ]
    caveats: List[str] = []
    if locked_spec.scm is None:
        return MetaSummary(
            identifiable=False,
            assumptions=[],
            caveats=["No SCM in spec; query not identifiable."],
            recommend="Attach SCMSpec and re-lock.",
        )
    if query_type == "predict_artifact" and artifact and artifact not in (
        eq.variable for eq in (locked_spec.scm.equations or [])
    ):
        caveats.append(f"Artifact '{artifact}' may not be a variable in the SCM.")
    reliability: Optional[Literal["low", "medium", "high"]] = "medium"
    return MetaSummary(
        identifiable=True,
        assumptions=assumptions,
        caveats=caveats if caveats else [],
        reliability=reliability,
        recommend=None,
    )
