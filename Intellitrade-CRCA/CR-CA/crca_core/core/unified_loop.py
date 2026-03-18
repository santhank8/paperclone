"""Unified loop: MC batch -> estimate + variance; meta -> strategy/stop; repeat until confident."""

from __future__ import annotations

from typing import List, Optional

from crca_core.core.event_aggregation import p_event, predict_artifact_at_t
from crca_core.core.meta_layer import check_identifiability
from crca_core.core.temporal_api import run_n_trajectories
from crca_core.models.provenance import ProvenanceManifest
from crca_core.models.refusal import RefusalResult
from crca_core.models.result import EventSpec, MetaSummary, PEventResult, PredictArtifactResult
from crca_core.models.spec import BranchSpec, LockedSpec, PathValues
from utils.canonical import stable_hash


def run_p_event_unified_loop(
    *,
    locked_spec: LockedSpec,
    event: EventSpec,
    observed_path: Optional[PathValues] = None,
    branches: Optional[List[BranchSpec]] = None,
    batch_size: int = 50,
    max_iterations: int = 20,
    ci_width_threshold: float = 0.05,
    seed: Optional[int] = None,
    allow_partial: bool = False,
) -> PEventResult | RefusalResult:
    """Run MC batches until CI width < threshold or max_iterations. Returns PEventResult with reliability."""
    all_paths: List[PathValues] = []
    rng_seed = seed
    for _ in range(max_iterations):
        result = run_n_trajectories(
            locked_spec=locked_spec,
            observed_path=observed_path,
            branches=branches,
            n=batch_size,
            seed=rng_seed,
            allow_partial=allow_partial,
        )
        if isinstance(result, RefusalResult):
            return result
        all_paths.extend(result)
        prob, std_err = p_event(all_paths, event)
        ci_half = 1.96 * std_err if std_err else 1.0
        if std_err is not None and 2 * ci_half <= ci_width_threshold:
            break
        rng_seed = (rng_seed or 0) + batch_size
    prob, std_err = p_event(all_paths, event)
    meta_raw = check_identifiability(locked_spec, "p_event")
    meta = MetaSummary(
        identifiable=meta_raw.identifiable,
        assumptions=meta_raw.assumptions,
        caveats=meta_raw.caveats,
        reliability="high" if (std_err and std_err < 0.02) else "medium",
        recommend=meta_raw.recommend,
    )
    prov = ProvenanceManifest.minimal(
        stable_hash(
            {
                "module": "run_p_event_unified_loop",
                "spec_hash": locked_spec.spec_hash,
                "event": event.model_dump(),
                "n_trajectories": len(all_paths),
            }
        )
    )
    return PEventResult(
        result_type="PEventResult",
        provenance=prov,
        p=prob,
        std_error=std_err,
        n_trajectories=len(all_paths),
        event=event.model_dump(),
        meta=meta,
    )


def run_predict_artifact_unified_loop(
    *,
    locked_spec: LockedSpec,
    artifact: str,
    time: int,
    observed_path: Optional[PathValues] = None,
    branches: Optional[List[BranchSpec]] = None,
    batch_size: int = 50,
    max_iterations: int = 20,
    std_threshold: Optional[float] = None,
    seed: Optional[int] = None,
    allow_partial: bool = False,
    return_samples: bool = True,
) -> PredictArtifactResult | RefusalResult:
    """Run MC batches until sufficient trajectories; return PredictArtifactResult with reliability."""
    all_paths: List[PathValues] = []
    rng_seed = seed
    for _ in range(max_iterations):
        result = run_n_trajectories(
            locked_spec=locked_spec,
            observed_path=observed_path,
            branches=branches,
            n=batch_size,
            seed=rng_seed,
            allow_partial=allow_partial,
        )
        if isinstance(result, RefusalResult):
            return result
        all_paths.extend(result)
        _, mean, std = predict_artifact_at_t(all_paths, artifact, time)
        if std_threshold is not None and std is not None and std <= std_threshold:
            break
        rng_seed = (rng_seed or 0) + batch_size
    samples, mean, std = predict_artifact_at_t(all_paths, artifact, time)
    meta = check_identifiability(
        locked_spec, "predict_artifact", artifact=artifact, time=time
    )
    prov = ProvenanceManifest.minimal(
        stable_hash(
            {
                "module": "run_predict_artifact_unified_loop",
                "spec_hash": locked_spec.spec_hash,
                "artifact": artifact,
                "time": time,
                "n_trajectories": len(all_paths),
            }
        )
    )
    return PredictArtifactResult(
        result_type="PredictArtifactResult",
        provenance=prov,
        artifact=artifact,
        time=time,
        mean=mean if samples else None,
        std=std if samples else None,
        samples=samples if return_samples else [],
        n_trajectories=len(all_paths),
        meta=meta,
    )
