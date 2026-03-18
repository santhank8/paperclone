"""Unified tool router with strict gating."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from crca_core.core.api import (
    EstimatorConfig,
    FeasibilityConstraints,
    PCMCIConfig,
    TabularDiscoveryConfig,
    TargetQuery,
    design_intervention,
    discover_tabular,
    discover_timeseries_pcmci,
    identify_effect,
    estimate_effect_dowhy,
    simulate_counterfactual,
)
from crca_core.core.temporal_api import (
    compute_p_event,
    compute_predict_artifact,
    run_n_trajectories,
)
from crca_core.core.unified_loop import (
    run_p_event_unified_loop,
    run_predict_artifact_unified_loop,
)
from crca_core.core.nested_mc import (
    run_nested_mc_p_event,
    run_nested_mc_predict_artifact,
)
from crca_core.models.refusal import RefusalChecklistItem, RefusalReasonCode, RefusalResult
from crca_core.models.result import AnyResult, EventSpec, IdentificationResult
from crca_core.models.spec import (
    BranchSpec,
    InterventionSchedule,
    LockedSpec,
    PathValues,
)


def _payload_to_path_values(obj: Optional[Dict[str, Any]]) -> Optional[PathValues]:
    """Convert payload dict (times, data) to PathValues. Returns None if obj is None or empty."""
    if not obj or not isinstance(obj, dict):
        return None
    times = obj.get("times")
    data = obj.get("data")
    if not times or not isinstance(data, dict):
        return None
    return PathValues(times=list(times), data={k: list(v) for k, v in data.items()})


def _payload_to_event_spec(obj: Optional[Dict[str, Any]]) -> Optional[EventSpec]:
    """Convert payload dict to EventSpec."""
    if not obj or not isinstance(obj, dict):
        return None
    artifact = obj.get("artifact")
    time_val = obj.get("time")
    if artifact is None or time_val is None:
        return None
    return EventSpec(
        artifact=str(artifact),
        time=int(time_val),
        op=obj.get("op", "in"),
        value=obj.get("value"),
        value_low=obj.get("value_low"),
        value_high=obj.get("value_high"),
    )


def _payload_to_branch_specs(obj: Any) -> List[BranchSpec]:
    """Convert payload list of scenario dicts to List[BranchSpec]. Returns [] if not a list."""
    if not isinstance(obj, list):
        return []
    out: List[BranchSpec] = []
    for item in obj:
        if not isinstance(item, dict):
            continue
        sched = None
        if item.get("intervention_schedule") and isinstance(item["intervention_schedule"], dict):
            by_time = item["intervention_schedule"].get("by_time") or {}
            if isinstance(by_time, dict):
                sched = InterventionSchedule(by_time={int(k): dict(v) for k, v in by_time.items() if isinstance(v, dict)})
        out.append(BranchSpec(scenario_id=item.get("scenario_id"), intervention_schedule=sched))
    return out


class ToolRouter:
    """Routes tool calls with pre-Act gating."""

    def __init__(self) -> None:
        self.last_identification: Optional[IdentificationResult] = None

    def call_tool(self, *, tool_name: str, payload: Dict[str, Any]) -> AnyResult | RefusalResult:
        gated_tools = {
            "identify", "estimate", "counterfactual", "design_intervention",
            "predict_artifact", "p_event", "nested_mc_p_event", "nested_mc_predict_artifact", "trajectories",
        }
        if tool_name in gated_tools:
            if payload.get("locked_spec") is None:
                return RefusalResult(
                    message="LockedSpec required for this tool.",
                    reason_codes=[RefusalReasonCode.SPEC_NOT_LOCKED],
                    checklist=[
                        RefusalChecklistItem(item="Provide LockedSpec", rationale="Tool is gated.")
                    ],
                    suggested_next_steps=["Lock a spec and retry."],
                )

        if tool_name == "identify":
            res = identify_effect(
                locked_spec=payload["locked_spec"],
                treatment=payload.get("treatment", ""),
                outcome=payload.get("outcome", ""),
            )
            if isinstance(res, IdentificationResult):
                self.last_identification = res
            return res

        if tool_name == "estimate":
            ident = payload.get("identification_result") or self.last_identification
            return estimate_effect_dowhy(
                data=payload.get("data"),
                locked_spec=payload["locked_spec"],
                treatment=payload.get("treatment", ""),
                outcome=payload.get("outcome", ""),
                identification_result=ident,
                config=payload.get("config", EstimatorConfig()),
            )

        if tool_name == "counterfactual":
            return simulate_counterfactual(
                locked_spec=payload["locked_spec"],
                factual_observation=payload.get("factual_observation", {}),
                intervention=payload.get("intervention", {}),
                allow_partial_observation=payload.get("allow_partial_observation", False),
            )

        if tool_name == "design_intervention":
            return design_intervention(
                locked_spec=payload["locked_spec"],
                target_query=payload.get("target_query", TargetQuery()),
                constraints=payload.get("constraints", FeasibilityConstraints()),
            )

        if tool_name == "discover_tabular":
            return discover_tabular(
                payload.get("data"),
                payload.get("config", TabularDiscoveryConfig()),
                payload.get("assumptions"),
            )

        if tool_name == "discover_timeseries":
            return discover_timeseries_pcmci(
                payload.get("data"),
                payload.get("config", PCMCIConfig()),
                payload.get("assumptions"),
            )

        locked = payload.get("locked_spec")
        if not isinstance(locked, LockedSpec):
            locked = LockedSpec.model_validate(locked) if locked else None

        if tool_name == "predict_artifact":
            if use_unified := payload.get("use_unified_loop"):
                return run_predict_artifact_unified_loop(
                    locked_spec=locked,
                    artifact=str(payload.get("artifact", "")),
                    time=int(payload.get("time", 0)),
                    observed_path=_payload_to_path_values(payload.get("observed_path")),
                    branches=_payload_to_branch_specs(payload.get("branches")) or None,
                    batch_size=int(payload.get("batch_size", 50)),
                    max_iterations=int(payload.get("max_iterations", 20)),
                    seed=payload.get("seed"),
                    allow_partial=bool(payload.get("allow_partial", False)),
                    return_samples=bool(payload.get("return_samples", True)),
                )
            return compute_predict_artifact(
                locked_spec=locked,
                artifact=str(payload.get("artifact", "")),
                time=int(payload.get("time", 0)),
                observed_path=_payload_to_path_values(payload.get("observed_path")),
                branches=_payload_to_branch_specs(payload.get("branches")) or None,
                n=int(payload.get("n", 100)),
                seed=payload.get("seed"),
                allow_partial=bool(payload.get("allow_partial", False)),
                return_samples=bool(payload.get("return_samples", True)),
            )

        if tool_name == "p_event":
            event = _payload_to_event_spec(payload.get("event"))
            if event is None:
                return RefusalResult(
                    message="p_event requires event (artifact, time, op, value/value_low/value_high).",
                    reason_codes=[RefusalReasonCode.INPUT_INVALID],
                    checklist=[RefusalChecklistItem(item="Provide event", rationale="Event spec required.")],
                    suggested_next_steps=["Pass event with artifact and time."],
                )
            if payload.get("use_unified_loop"):
                return run_p_event_unified_loop(
                    locked_spec=locked,
                    event=event,
                    observed_path=_payload_to_path_values(payload.get("observed_path")),
                    branches=_payload_to_branch_specs(payload.get("branches")) or None,
                    batch_size=int(payload.get("batch_size", 50)),
                    max_iterations=int(payload.get("max_iterations", 20)),
                    ci_width_threshold=float(payload.get("ci_width_threshold", 0.05)),
                    seed=payload.get("seed"),
                    allow_partial=bool(payload.get("allow_partial", False)),
                )
            return compute_p_event(
                locked_spec=locked,
                event=event,
                observed_path=_payload_to_path_values(payload.get("observed_path")),
                branches=_payload_to_branch_specs(payload.get("branches")) or None,
                n=int(payload.get("n", 100)),
                seed=payload.get("seed"),
                allow_partial=bool(payload.get("allow_partial", False)),
            )

        if tool_name == "nested_mc_p_event":
            event = _payload_to_event_spec(payload.get("event"))
            if event is None:
                return RefusalResult(
                    message="nested_mc_p_event requires event (artifact, time, op, value/value_low/value_high).",
                    reason_codes=[RefusalReasonCode.INPUT_INVALID],
                    checklist=[RefusalChecklistItem(item="Provide event", rationale="Event spec required.")],
                    suggested_next_steps=["Pass event with artifact and time."],
                )
            scenarios = _payload_to_branch_specs(payload.get("scenarios"))
            if not scenarios:
                return RefusalResult(
                    message="nested_mc_p_event requires scenarios (list of branch specs).",
                    reason_codes=[RefusalReasonCode.INPUT_INVALID],
                    checklist=[RefusalChecklistItem(item="Provide scenarios", rationale="At least one scenario required.")],
                    suggested_next_steps=["Pass scenarios list with optional scenario_id and intervention_schedule."],
                )
            return run_nested_mc_p_event(
                locked_spec=locked,
                event=event,
                scenarios=scenarios,
                m_per_scenario=int(payload.get("m_per_scenario", 20)),
                observed_path=_payload_to_path_values(payload.get("observed_path")),
                seed=payload.get("seed"),
                allow_partial=bool(payload.get("allow_partial", False)),
            )

        if tool_name == "nested_mc_predict_artifact":
            scenarios = _payload_to_branch_specs(payload.get("scenarios"))
            if not scenarios:
                return RefusalResult(
                    message="nested_mc_predict_artifact requires scenarios (list of branch specs).",
                    reason_codes=[RefusalReasonCode.INPUT_INVALID],
                    checklist=[RefusalChecklistItem(item="Provide scenarios", rationale="At least one scenario required.")],
                    suggested_next_steps=["Pass scenarios list."],
                )
            return run_nested_mc_predict_artifact(
                locked_spec=locked,
                artifact=str(payload.get("artifact", "")),
                time=int(payload.get("time", 0)),
                scenarios=scenarios,
                m_per_scenario=int(payload.get("m_per_scenario", 20)),
                observed_path=_payload_to_path_values(payload.get("observed_path")),
                seed=payload.get("seed"),
                allow_partial=bool(payload.get("allow_partial", False)),
                return_samples=bool(payload.get("return_samples", True)),
            )

        if tool_name == "trajectories":
            result = run_n_trajectories(
                locked_spec=locked,
                observed_path=_payload_to_path_values(payload.get("observed_path")),
                branches=_payload_to_branch_specs(payload.get("branches")) or None,
                n=int(payload.get("n", 10)),
                seed=payload.get("seed"),
                allow_partial=bool(payload.get("allow_partial", False)),
            )
            return result

        return RefusalResult(
            message=f"Unknown tool: {tool_name}",
            reason_codes=[RefusalReasonCode.UNSUPPORTED_OPERATION],
            checklist=[RefusalChecklistItem(item="Use a supported tool", rationale="Unknown tool name.")],
        )
