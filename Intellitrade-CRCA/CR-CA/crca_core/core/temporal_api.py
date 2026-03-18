"""Temporal counterfactual API: one trajectory, N trajectories (branching), P(event), predict artifact at T."""

from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np

from crca_core.core.event_aggregation import p_event, predict_artifact_at_t
from crca_core.core.meta_layer import check_identifiability
from crca_core.integrity import assert_locked_spec_integrity
from crca_core.models.provenance import ProvenanceManifest
from crca_core.models.refusal import RefusalChecklistItem, RefusalReasonCode, RefusalResult
from crca_core.models.result import EventSpec, PEventResult, PredictArtifactResult
from crca_core.models.spec import (
    BranchSpec,
    InterventionSchedule,
    LockedSpec,
    PathValues,
)
from crca_core.scm.temporal_linear_gaussian import TemporalLinearGaussianSCM
from utils.canonical import stable_hash


def run_temporal_trajectory(
    *,
    locked_spec: LockedSpec,
    observed_path: PathValues,
    intervention_schedule: Optional[InterventionSchedule] = None,
    allow_partial: bool = False,
) -> PathValues | RefusalResult:
    """Run one temporal trajectory: abduce U from observed path, then forward with optional interventions."""
    try:
        assert_locked_spec_integrity(locked_spec)
    except ValueError as exc:
        return RefusalResult(
            message=str(exc),
            reason_codes=[RefusalReasonCode.LOCKED_SPEC_INTEGRITY_FAIL],
            checklist=[RefusalChecklistItem(item="Re-lock spec", rationale="Integrity check failed.")],
            suggested_next_steps=["Re-lock the spec and retry."],
        )
    if locked_spec.scm is None:
        return RefusalResult(
            message="Temporal trajectories require an explicit SCMSpec.",
            reason_codes=[RefusalReasonCode.NO_SCM_FOR_COUNTERFACTUAL],
            checklist=[RefusalChecklistItem(item="Provide SCMSpec", rationale="SCM required.")],
            suggested_next_steps=["Attach a SCMSpec with optional parent_lags and temporal config, then re-lock."],
        )
    try:
        scm = TemporalLinearGaussianSCM.from_spec(locked_spec.scm)
    except ValueError as exc:
        return RefusalResult(
            message=str(exc),
            reason_codes=[RefusalReasonCode.INPUT_INVALID],
            checklist=[RefusalChecklistItem(item="Fix SCM spec", rationale="Invalid equations or lags.")],
            suggested_next_steps=["Check equations and parent_lags."],
        )
    try:
        u_path = scm.abduce_noise_from_path(observed_path, allow_partial=allow_partial)
    except ValueError as exc:
        return RefusalResult(
            message=str(exc),
            reason_codes=[RefusalReasonCode.INPUT_INVALID],
            checklist=[RefusalChecklistItem(item="Provide full path", rationale="Abduction needs observed path.")],
            suggested_next_steps=["Provide path with all required variables and times."],
        )
    path = scm.run_one_trajectory(u_path, interventions=intervention_schedule, times=observed_path.times)
    return path


def run_n_trajectories(
    *,
    locked_spec: LockedSpec,
    observed_path: Optional[PathValues] = None,
    branches: Optional[List[BranchSpec]] = None,
    n: int = 1,
    seed: Optional[int] = None,
    allow_partial: bool = False,
) -> List[PathValues] | RefusalResult:
    """Run N trajectories. If observed_path given, abduce U once and apply each branch; else sample U n times (one branch or default)."""
    try:
        assert_locked_spec_integrity(locked_spec)
    except ValueError as exc:
        return RefusalResult(
            message=str(exc),
            reason_codes=[RefusalReasonCode.LOCKED_SPEC_INTEGRITY_FAIL],
            checklist=[RefusalChecklistItem(item="Re-lock spec", rationale="Integrity check failed.")],
            suggested_next_steps=["Re-lock the spec and retry."],
        )
    if locked_spec.scm is None:
        return RefusalResult(
            message="Temporal trajectories require an explicit SCMSpec.",
            reason_codes=[RefusalReasonCode.NO_SCM_FOR_COUNTERFACTUAL],
            checklist=[RefusalChecklistItem(item="Provide SCMSpec", rationale="SCM required.")],
            suggested_next_steps=["Attach a SCMSpec, then re-lock."],
        )
    try:
        scm = TemporalLinearGaussianSCM.from_spec(locked_spec.scm)
    except ValueError as exc:
        return RefusalResult(
            message=str(exc),
            reason_codes=[RefusalReasonCode.INPUT_INVALID],
            checklist=[RefusalChecklistItem(item="Fix SCM spec", rationale="Invalid spec.")],
            suggested_next_steps=["Check equations and parent_lags."],
        )
    rng = np.random.default_rng(seed)
    out: List[PathValues] = []
    times = list(range(51))  # default
    if observed_path is not None:
        times = observed_path.times
        try:
            u_path = scm.abduce_noise_from_path(observed_path, allow_partial=allow_partial)
        except ValueError as exc:
            return RefusalResult(
                message=str(exc),
                reason_codes=[RefusalReasonCode.INPUT_INVALID],
                checklist=[RefusalChecklistItem(item="Provide full path", rationale="Abduction needs path.")],
                suggested_next_steps=["Provide valid path."],
            )
        if branches:
            for branch in branches[:n]:
                sched = branch.intervention_schedule if branch else None
                path = scm.run_one_trajectory(u_path, interventions=sched, times=times)
                out.append(path)
        else:
            path = scm.run_one_trajectory(u_path, times=times)
            out.append(path)
    else:
        for i in range(n):
            u_path = {
                v: rng.standard_normal(len(times)).tolist()
                for v in scm.variables
            }
            sched = None
            if branches and i < len(branches) and branches[i] is not None:
                sched = branches[i].intervention_schedule
            path = scm.run_one_trajectory(u_path, times=times, interventions=sched)
            out.append(path)
    return out[:n]


def compute_p_event(
    *,
    locked_spec: LockedSpec,
    event: EventSpec,
    observed_path: Optional[PathValues] = None,
    branches: Optional[List[BranchSpec]] = None,
    n: int = 100,
    seed: Optional[int] = None,
    allow_partial: bool = False,
) -> PEventResult | RefusalResult:
    """Estimate P(event) over N trajectories; returns PEventResult with p and optional std_error."""
    paths_result = run_n_trajectories(
        locked_spec=locked_spec,
        observed_path=observed_path,
        branches=branches,
        n=n,
        seed=seed,
        allow_partial=allow_partial,
    )
    if isinstance(paths_result, RefusalResult):
        return paths_result
    prob, std_err = p_event(paths_result, event)
    prov = ProvenanceManifest.minimal(
        stable_hash(
            {
                "module": "compute_p_event",
                "spec_hash": locked_spec.spec_hash,
                "event": event.model_dump(),
                "n": n,
            }
        )
    )
    meta = check_identifiability(locked_spec, "p_event")
    return PEventResult(
        result_type="PEventResult",
        provenance=prov,
        p=prob,
        std_error=std_err,
        n_trajectories=len(paths_result),
        event=event.model_dump(),
        meta=meta,
    )


def compute_predict_artifact(
    *,
    locked_spec: LockedSpec,
    artifact: str,
    time: int,
    observed_path: Optional[PathValues] = None,
    branches: Optional[List[BranchSpec]] = None,
    n: int = 100,
    seed: Optional[int] = None,
    allow_partial: bool = False,
    return_samples: bool = True,
) -> PredictArtifactResult | RefusalResult:
    """Predict distribution of artifact at time T over N trajectories."""
    paths_result = run_n_trajectories(
        locked_spec=locked_spec,
        observed_path=observed_path,
        branches=branches,
        n=n,
        seed=seed,
        allow_partial=allow_partial,
    )
    if isinstance(paths_result, RefusalResult):
        return paths_result
    samples, mean, std = predict_artifact_at_t(paths_result, artifact, time)
    prov = ProvenanceManifest.minimal(
        stable_hash(
            {
                "module": "compute_predict_artifact",
                "spec_hash": locked_spec.spec_hash,
                "artifact": artifact,
                "time": time,
                "n": n,
            }
        )
    )
    meta = check_identifiability(
        locked_spec, "predict_artifact", artifact=artifact, time=time
    )
    return PredictArtifactResult(
        result_type="PredictArtifactResult",
        provenance=prov,
        artifact=artifact,
        time=time,
        mean=mean if samples else None,
        std=std if samples else None,
        samples=samples if return_samples else [],
        n_trajectories=len(paths_result),
        meta=meta,
    )
