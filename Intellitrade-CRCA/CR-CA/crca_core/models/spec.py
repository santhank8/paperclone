"""Typed causal specification objects (Draft → Locked)."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field


class SpecStatus(str, Enum):
    draft = "draft"
    locked = "locked"


class AssumptionStatus(str, Enum):
    declared = "declared"
    contested = "contested"
    violated = "violated"
    unknown = "unknown"


class DataColumnSpec(BaseModel):
    name: str = Field(..., min_length=1)
    dtype: str = Field(..., min_length=1)
    allowed_range: Optional[Tuple[float, float]] = None
    missingness_expected: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    unit: Optional[str] = None
    description: Optional[str] = None


class TimeIndexSpec(BaseModel):
    column: str = Field(..., min_length=1)
    frequency: Optional[str] = None
    timezone: Optional[str] = None
    irregular_sampling_policy: Optional[str] = None


class EntityIndexSpec(BaseModel):
    entity_id_column: str = Field(..., min_length=1)
    time_column: str = Field(..., min_length=1)


class DataSpec(BaseModel):
    dataset_name: Optional[str] = None
    dataset_hash: Optional[str] = None
    columns: List[DataColumnSpec] = Field(default_factory=list)
    time_index: Optional[TimeIndexSpec] = None
    entity_index: Optional[EntityIndexSpec] = None
    measurement_error_notes: Optional[str] = None
    proxy_variables: Dict[str, str] = Field(default_factory=dict)


class NodeSpec(BaseModel):
    name: str = Field(..., min_length=1)
    observed: bool = True
    unit: Optional[str] = None
    description: Optional[str] = None


class EdgeSpec(BaseModel):
    source: str = Field(..., min_length=1)
    target: str = Field(..., min_length=1)
    lag: Optional[int] = None
    description: Optional[str] = None


class CausalGraphSpec(BaseModel):
    nodes: List[NodeSpec] = Field(default_factory=list)
    edges: List[EdgeSpec] = Field(default_factory=list)
    latent_confounders: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class RoleSpec(BaseModel):
    treatments: List[str] = Field(default_factory=list)
    outcomes: List[str] = Field(default_factory=list)
    mediators: List[str] = Field(default_factory=list)
    instruments: List[str] = Field(default_factory=list)
    adjustment_candidates: List[str] = Field(default_factory=list)
    prohibited_controls: List[str] = Field(default_factory=list)


class AssumptionItem(BaseModel):
    name: str = Field(..., min_length=1)
    status: AssumptionStatus = AssumptionStatus.unknown
    description: Optional[str] = None
    evidence: Optional[str] = None


class AssumptionSpec(BaseModel):
    items: List[AssumptionItem] = Field(default_factory=list)
    falsification_plan: List[str] = Field(default_factory=list)


class NoiseSpec(BaseModel):
    distribution: Literal["gaussian"] = "gaussian"
    params: Dict[str, Any] = Field(default_factory=dict)


class StructuralEquationSpec(BaseModel):
    """Represents one structural equation V = f(Pa(V), U_V).

    v0.1: store both a human-readable formula and an executable parameterization
    for supported SCM families. For temporal SCMs, use parent_lags so that
    V_t = intercept + sum_p coefficient[p] * p_{t+lag[p]} + U_V (lag negative = past).
    """

    variable: str = Field(..., min_length=1)
    parents: List[str] = Field(default_factory=list)
    form: Literal["linear_gaussian"] = "linear_gaussian"
    coefficients: Dict[str, float] = Field(default_factory=dict)  # parent -> beta
    intercept: float = 0.0
    noise: NoiseSpec = Field(default_factory=NoiseSpec)
    # Temporal: parent -> lag (e.g. -1 for t-1). Omitted or 0 = same-time/snapshot. Enables V_t = f(Pa_{t+lag}, U).
    parent_lags: Optional[Dict[str, int]] = None


class TemporalConfig(BaseModel):
    """Config for temporal SCM: time range and step interpretation."""

    t_start: int = 0
    t_end: Optional[int] = None  # None = unbounded or inferred from path
    step: int = 1


class PathValues(BaseModel):
    """First-class path: assignment to (variable, time) over a time range.

    times[i] is the time index; data[var] is a list of values with same length as times.
    """

    times: List[int] = Field(..., min_length=1)
    data: Dict[str, List[float]] = Field(default_factory=dict)

    def get_at(self, variable: str, t: int) -> Optional[float]:
        """Return value of variable at time t if present."""
        if variable not in self.data:
            return None
        try:
            i = self.times.index(t)
            return self.data[variable][i]
        except (ValueError, IndexError):
            return None

    def variables(self) -> List[str]:
        return list(self.data.keys())


class InterventionSchedule(BaseModel):
    """Interventions by time step: at each t, optional do(var=value)."""

    by_time: Dict[int, Dict[str, float]] = Field(default_factory=dict, description="t -> {var: value}")


class BranchSpec(BaseModel):
    """First-class branch: scenario id and optional intervention schedule."""

    scenario_id: Optional[str] = None
    intervention_schedule: Optional[InterventionSchedule] = None


class SCMSpec(BaseModel):
    """Explicit SCM required for counterfactuals."""

    scm_type: Literal["linear_gaussian"] = "linear_gaussian"
    equations: List[StructuralEquationSpec] = Field(default_factory=list)
    # Optional correlated noise for linear-Gaussian SCMs (advanced; v0.1 may require diagonal)
    noise_cov: Optional[List[List[float]]] = None
    intervention_semantics: Dict[str, str] = Field(default_factory=dict)  # var -> set/shift/mechanism-change
    temporal: Optional[TemporalConfig] = None


class DraftSpec(BaseModel):
    """Draft spec (may be LLM-generated; never authorizes numeric causal outputs)."""

    status: SpecStatus = Field(default=SpecStatus.draft, frozen=True)
    data: DataSpec = Field(default_factory=DataSpec)
    graph: CausalGraphSpec = Field(default_factory=CausalGraphSpec)
    roles: RoleSpec = Field(default_factory=RoleSpec)
    assumptions: AssumptionSpec = Field(default_factory=AssumptionSpec)
    scm: Optional[SCMSpec] = None
    draft_notes: Optional[str] = None


class LockedSpec(BaseModel):
    """Locked spec (authoritative for identification/estimation/simulation semantics)."""

    status: SpecStatus = Field(default=SpecStatus.locked, frozen=True)
    spec_hash: str
    approvals: List[str] = Field(default_factory=list)
    locked_at_utc: str

    data: DataSpec
    graph: CausalGraphSpec
    roles: RoleSpec
    assumptions: AssumptionSpec
    scm: Optional[SCMSpec] = None

