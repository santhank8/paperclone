# Intervention design

**Where it lives:** `crca_core.core.intervention_design`

Intervention design proposes **experiments or measurements** to support identifiability or hypothesis discrimination. v0.1 is **graphical and non-probabilistic**: it does not compute numeric information gain; it produces structured candidate designs with prerequisites and rationale.

---

## Types

```python
class TargetQuery(BaseModel):
    query_type: Literal["identify_effect", "reduce_uncertainty_edge"] = "identify_effect"
    treatment: Optional[str] = None
    outcome: Optional[str] = None
    edge_source: Optional[str] = None
    edge_target: Optional[str] = None

class FeasibilityConstraints(BaseModel):
    manipulable_variables: List[str] = []
    observable_variables: List[str] = []
    costs: Dict[str, Any] = {}
    ethics_notes: Optional[str] = None

class DesignCandidate(BaseModel):
    design_type: str
    mechanism: str
    prerequisites: List[str] = []
    feasibility_inputs_needed: List[str] = []
    notes: Optional[str] = None
```

---

## design_intervention

```python
def design_intervention(
    *,
    locked_spec: Any,
    target_query: TargetQuery,
    constraints: Optional[FeasibilityConstraints] = None,
) -> InterventionDesignResult:
```

**Args:**

- **locked_spec:** LockedSpec (or object with `spec_hash`); used for graph and provenance.
- **target_query:** What to target: `identify_effect` (treatment/outcome) or `reduce_uncertainty_edge` (edge_source/edge_target).
- **constraints:** Optional feasibility (manipulable/observable variables, costs, ethics_notes).

**Returns:** **InterventionDesignResult** with `provenance`, `assumptions`, `limitations`, and `designs` (list of design candidates). v0.1 does not guarantee identifiability; it suggests designs that could help under explicit assumptions.

**Behaviour (identify_effect):** If treatment and outcome are provided, proposes designs such as: randomize treatment if feasible, measure confounders, or add mediators. Each design is a **DesignCandidate** with `design_type`, `mechanism`, `prerequisites`, and `feasibility_inputs_needed`.

Provenance hashes spec_hash, target_query, and constraints (no raw data).
