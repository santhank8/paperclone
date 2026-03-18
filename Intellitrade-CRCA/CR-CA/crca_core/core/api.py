"""Public API functions for the H1 `crca_core`.

These functions provide the stable, refusal-first entry points that other
layers (including LLM tooling) should call.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from crca_core.core.estimate import EstimatorConfig, estimate_effect_dowhy
from crca_core.integrity import assert_locked_spec_integrity
from crca_core.identify import identify_effect
from crca_core.core.intervention_design import (
    FeasibilityConstraints,
    TargetQuery,
    design_intervention,
)
from crca_core.models.provenance import ProvenanceManifest
from crca_core.models.refusal import RefusalChecklistItem, RefusalReasonCode, RefusalResult
from crca_core.models.result import CounterfactualResult
from crca_core.scm import LinearGaussianSCM
from crca_core.models.spec import DraftSpec, LockedSpec
from crca_core.timeseries.pcmci import PCMCIConfig, discover_timeseries_pcmci
from crca_core.discovery.tabular import TabularDiscoveryConfig, discover_tabular
from crca_core.validation.consistency import verify_counterfactual_result
from utils.canonical import stable_hash


def simulate_counterfactual(
    *,
    locked_spec: LockedSpec,
    factual_observation: Dict[str, float],
    intervention: Dict[str, float],
    allow_partial_observation: bool = False,
) -> CounterfactualResult | RefusalResult:
    """Simulate a counterfactual under an explicit SCM (required).

    Refuses if `locked_spec.scm` is missing.
    """

    try:
        assert_locked_spec_integrity(locked_spec)
    except ValueError as exc:
        return RefusalResult(
            message=str(exc),
            reason_codes=[RefusalReasonCode.LOCKED_SPEC_INTEGRITY_FAIL],
            checklist=[
                RefusalChecklistItem(
                    item="Re-lock spec",
                    rationale="Locked structural payload changed after lock and failed integrity checks.",
                )
            ],
            suggested_next_steps=[
                "Recreate the DraftSpec, lock it again, and retry counterfactual simulation."
            ],
        )

    if locked_spec.scm is None:
        return RefusalResult(
            message="Counterfactuals require an explicit SCMSpec (structural equations + noise model).",
            reason_codes=[RefusalReasonCode.NO_SCM_FOR_COUNTERFACTUAL],
            checklist=[
                RefusalChecklistItem(
                    item="Provide SCMSpec",
                    rationale="A DAG alone does not define counterfactual semantics; SCM is required.",
                )
            ],
            suggested_next_steps=[
                "Attach a SCMSpec (e.g., linear_gaussian) to the spec, then re-lock and retry."
            ],
        )

    scm = LinearGaussianSCM.from_spec(locked_spec.scm)

    semantics = dict(locked_spec.scm.intervention_semantics or {})
    unsupported = {
        var: sem
        for var, sem in semantics.items()
        if var in intervention and str(sem).strip().lower() != "set"
    }
    if unsupported:
        return RefusalResult(
            message=(
                "Unsupported intervention semantics for v1 counterfactual execution: "
                + ", ".join(f"{k}={v}" for k, v in unsupported.items())
                + ". Only 'set' semantics are currently supported."
            ),
            reason_codes=[RefusalReasonCode.UNSUPPORTED_OPERATION],
            checklist=[
                RefusalChecklistItem(
                    item="Use set semantics",
                    rationale="v1 action phase supports do(X=x) set interventions only.",
                )
            ],
            suggested_next_steps=[
                "Set SCMSpec.intervention_semantics[var] = 'set' for intervened variables."
            ],
        )

    unknown_intervention_vars = [k for k in intervention if k not in set(scm.variables)]
    if unknown_intervention_vars:
        return RefusalResult(
            message=f"Intervention variables not present in SCM: {unknown_intervention_vars}",
            reason_codes=[RefusalReasonCode.INPUT_INVALID],
            checklist=[
                RefusalChecklistItem(
                    item="Use valid intervention variables",
                    rationale="Action phase can only intervene on endogenous SCM variables.",
                )
            ],
            suggested_next_steps=["Use variables defined by the locked SCMSpec equations."],
        )

    try:
        u = scm.abduce_noise(factual_observation, allow_partial=allow_partial_observation)
    except ValueError as exc:
        return RefusalResult(
            message=str(exc),
            reason_codes=[RefusalReasonCode.INPUT_INVALID],
            checklist=[
                RefusalChecklistItem(
                    item="Provide complete factual observation",
                    rationale="Counterfactuals require abduction for all endogenous variables in v1.0 unless partial mode is enabled.",
                )
            ],
            suggested_next_steps=[
                "Provide all endogenous variables or set allow_partial_observation=True (partial mode)."
            ],
        )
    cf = scm.predict(u, interventions=intervention)

    ok, err = verify_counterfactual_result(
        locked_spec, factual_observation, intervention, dict(cf)
    )
    if not ok:
        return RefusalResult(
            message=err or "Counterfactual consistency check failed.",
            reason_codes=[RefusalReasonCode.INPUT_INVALID],
            checklist=[
                RefusalChecklistItem(
                    item="Structural consistency",
                    rationale="Kernel recompute did not match result; rejecting.",
                )
            ],
            suggested_next_steps=["Check SCM equations and factual observation."],
        )

    prov = ProvenanceManifest.minimal(
        spec_hash=stable_hash(
            {
                "spec_hash": locked_spec.spec_hash,
                "module": "simulate_counterfactual",
                "intervention": intervention,
                "factual_keys": sorted(list(factual_observation.keys())),
            }
        )
    )

    structural_equations_used = scm.to_structural_equations()
    intervention_do = ("do(" + ", ".join(f"{k}={v}" for k, v in intervention.items()) + ")") if intervention else None
    all_vars = sorted(set(factual_observation) | set(cf))
    factual_vs_counterfactual = {
        var: {
            "factual": factual_observation.get(var),
            "counterfactual": cf.get(var),
        }
        for var in all_vars
    }

    factual_world = {
        "observation": dict(factual_observation),
        "abduced_u": dict(u),
        "result": dict(factual_observation),
    }
    counterfactual_world = {
        "intervention": dict(intervention),
        "abduced_u": dict(u),
        "result": dict(cf),
    }

    return CounterfactualResult(
        provenance=prov,
        assumptions=[
            "SCM structure and parameters are correct (strong assumption).",
            "Factual observation includes all endogenous variables for abduction in v1.0 unless partial mode is enabled.",
        ],
        limitations=[
            "v0.1 counterfactuals require a fully observed system (no missing variables).",
            "Only linear-Gaussian SCMs are supported in v0.1.",
        ],
        counterfactual={"factual": dict(factual_observation), "do": dict(intervention), "result": cf},
        structural_equations_used=structural_equations_used,
        intervention_do=intervention_do,
        abduced_u=dict(u),
        factual_vs_counterfactual=factual_vs_counterfactual,
        factual_world=factual_world,
        counterfactual_world=counterfactual_world,
    )


__all__ = [
    # Core lifecycle
    "DraftSpec",
    "LockedSpec",
    # Identification
    "identify_effect",
    # Discovery
    "TabularDiscoveryConfig",
    "discover_tabular",
    "PCMCIConfig",
    "discover_timeseries_pcmci",
    # Design
    "TargetQuery",
    "FeasibilityConstraints",
    "design_intervention",
    # Counterfactuals
    "simulate_counterfactual",
    # Estimation
    "EstimatorConfig",
    "estimate_effect_dowhy",
]

