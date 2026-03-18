"""Nested MC: K scenarios x M trajectories per scenario. Optional learning-guided and GPU stubs."""

from __future__ import annotations

from typing import Callable, List, Optional

from crca_core.core.event_aggregation import p_event, predict_artifact_at_t
from crca_core.core.temporal_api import run_n_trajectories
from crca_core.models.refusal import RefusalResult
from crca_core.models.result import EventSpec, PEventResult, PredictArtifactResult
from crca_core.models.spec import BranchSpec, LockedSpec, PathValues
from crca_core.models.provenance import ProvenanceManifest
from crca_core.core.meta_layer import check_identifiability
from utils.canonical import stable_hash


def run_nested_mc_p_event(
    *,
    locked_spec: LockedSpec,
    event: EventSpec,
    scenarios: List[BranchSpec],
    m_per_scenario: int = 20,
    observed_path: Optional[PathValues] = None,
    seed: Optional[int] = None,
    allow_partial: bool = False,
    use_gpu: bool = False,
    proposal: Optional[Callable[..., float]] = None,
    surrogate: Optional[Callable[..., float]] = None,
) -> PEventResult | RefusalResult:
    """Nested MC: K scenarios (branches) x M trajectories each. Aggregate P(event) with correct weighting.
    use_gpu, proposal, surrogate are reserved for future use (ignored).
    """
    _ = use_gpu, proposal, surrogate
    all_paths: List[PathValues] = []
    rng = seed
    for branch in scenarios:
        result = run_n_trajectories(
            locked_spec=locked_spec,
            observed_path=observed_path,
            branches=[branch],
            n=m_per_scenario,
            seed=rng,
            allow_partial=allow_partial,
        )
        if isinstance(result, RefusalResult):
            return result
        all_paths.extend(result)
        rng = (rng or 0) + m_per_scenario
    prob, std_err = p_event(all_paths, event)
    meta = check_identifiability(locked_spec, "p_event")
    prov = ProvenanceManifest.minimal(
        stable_hash(
            {
                "module": "run_nested_mc_p_event",
                "spec_hash": locked_spec.spec_hash,
                "event": event.model_dump(),
                "k": len(scenarios),
                "m": m_per_scenario,
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


def run_nested_mc_predict_artifact(
    *,
    locked_spec: LockedSpec,
    artifact: str,
    time: int,
    scenarios: List[BranchSpec],
    m_per_scenario: int = 20,
    observed_path: Optional[PathValues] = None,
    seed: Optional[int] = None,
    allow_partial: bool = False,
    return_samples: bool = True,
    use_gpu: bool = False,
    proposal: Optional[Callable[..., float]] = None,
    surrogate: Optional[Callable[..., float]] = None,
) -> PredictArtifactResult | RefusalResult:
    """Nested MC: K scenarios x M trajectories; aggregate artifact at T. GPU/proposal/surrogate reserved."""
    _ = use_gpu, proposal, surrogate
    all_paths: List[PathValues] = []
    rng = seed
    for branch in scenarios:
        result = run_n_trajectories(
            locked_spec=locked_spec,
            observed_path=observed_path,
            branches=[branch],
            n=m_per_scenario,
            seed=rng,
            allow_partial=allow_partial,
        )
        if isinstance(result, RefusalResult):
            return result
        all_paths.extend(result)
        rng = (rng or 0) + m_per_scenario
    samples, mean, std = predict_artifact_at_t(all_paths, artifact, time)
    meta = check_identifiability(
        locked_spec, "predict_artifact", artifact=artifact, time=time
    )
    prov = ProvenanceManifest.minimal(
        stable_hash(
            {
                "module": "run_nested_mc_predict_artifact",
                "spec_hash": locked_spec.spec_hash,
                "artifact": artifact,
                "time": time,
                "k": len(scenarios),
                "m": m_per_scenario,
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
