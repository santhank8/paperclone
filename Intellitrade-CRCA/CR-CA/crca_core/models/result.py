"""Structured result types for crca_core.

All results are structured objects. Human-readable reports must be generated
by rendering these objects, not by mixing narrative into scientific fields.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from crca_core.models.provenance import ProvenanceManifest
from crca_core.models.refusal import RefusalResult


class ValidationIssue(BaseModel):
    code: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    path: Optional[str] = None


class ValidationReport(BaseModel):
    """Returned by `validate_spec`."""

    ok: bool
    errors: List[ValidationIssue] = Field(default_factory=list)
    warnings: List[ValidationIssue] = Field(default_factory=list)


class BaseResult(BaseModel):
    """Base result type with mandatory provenance."""

    result_type: str
    provenance: ProvenanceManifest
    assumptions: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    artifacts: Dict[str, Any] = Field(default_factory=dict)


class DiscoveryHypothesisResult(BaseResult):
    result_type: Literal["DiscoveryHypothesis"] = "DiscoveryHypothesis"
    graph_hypothesis: Dict[str, Any] = Field(default_factory=dict)
    stability_report: Dict[str, Any] = Field(default_factory=dict)


class InterventionDesignResult(BaseResult):
    result_type: Literal["InterventionDesign"] = "InterventionDesign"
    designs: List[Dict[str, Any]] = Field(default_factory=list)


class CounterfactualResult(BaseResult):
    result_type: Literal["CounterfactualResult"] = "CounterfactualResult"
    counterfactual: Dict[str, Any] = Field(default_factory=dict)
    # Equation-level fields (Pearl-style) for agent reasoning and explanations
    structural_equations_used: Optional[List[str]] = None
    intervention_do: Optional[str] = None
    abduced_u: Optional[Dict[str, float]] = None
    factual_vs_counterfactual: Optional[Dict[str, Any]] = None
    # Explicit world separation (intervention semantics)
    factual_world: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Factual world: observation and abduced U (no intervention).",
    )
    counterfactual_world: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Counterfactual world: same U, do-intervention applied, propagated result.",
    )


class IdentificationResult(BaseResult):
    result_type: Literal["IdentificationResult"] = "IdentificationResult"
    method: str
    scope: Literal["conservative", "partial", "complete"] = "conservative"
    confidence: Literal["low", "medium", "high"] = "low"
    estimand_expression: str
    assumptions_used: List[str] = Field(default_factory=list)
    witnesses: Dict[str, Any] = Field(default_factory=dict)
    proof: Dict[str, Any] = Field(default_factory=dict)


class EstimateResult(BaseResult):
    result_type: Literal["EstimateResult"] = "EstimateResult"
    estimate: Dict[str, Any] = Field(default_factory=dict)
    refutations: Dict[str, Any] = Field(default_factory=dict)


class EventSpec(BaseModel):
    """Event = artifact (variable) at time T with condition (e.g. in [a,b], > threshold)."""

    artifact: str = Field(..., min_length=1, description="Variable / artifact id")
    time: int = Field(..., description="Time index T")
    op: Literal["in", "gt", "gte", "lt", "lte", "eq"] = "in"
    value: Optional[float] = None
    value_low: Optional[float] = None
    value_high: Optional[float] = None


class MetaSummary(BaseModel):
    """Meta layer: identifiability, assumptions, reliability of numerical estimate."""

    identifiable: Optional[bool] = None
    assumptions: List[str] = Field(default_factory=list)
    caveats: List[str] = Field(default_factory=list)
    reliability: Optional[Literal["low", "medium", "high"]] = None
    recommend: Optional[str] = None


class PEventResult(BaseResult):
    result_type: Literal["PEventResult"] = "PEventResult"
    p: float = Field(..., ge=0.0, le=1.0)
    std_error: Optional[float] = None
    n_trajectories: int = 0
    event: Optional[Dict[str, Any]] = None
    meta: Optional[MetaSummary] = None


class PredictArtifactResult(BaseResult):
    result_type: Literal["PredictArtifactResult"] = "PredictArtifactResult"
    artifact: str = Field(..., min_length=1)
    time: int = 0
    mean: Optional[float] = None
    std: Optional[float] = None
    samples: List[float] = Field(default_factory=list)
    n_trajectories: int = 0
    meta: Optional[MetaSummary] = None


AnyResult = (
    RefusalResult
    | ValidationReport
    | DiscoveryHypothesisResult
    | InterventionDesignResult
    | CounterfactualResult
    | IdentificationResult
    | EstimateResult
    | PEventResult
    | PredictArtifactResult
)

