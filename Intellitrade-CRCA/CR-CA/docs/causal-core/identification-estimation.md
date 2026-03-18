# Identification and estimation

**Where it lives:** `crca_core.identify`, `crca_core.core.estimate`

Identification determines whether a causal effect is **identifiable** from the graph and assumptions; estimation (DoWhy) produces a numeric effect estimate and optional refuters.

---

## identify_effect

**Module:** `crca_core.identify`

```python
def identify_effect(
    *,
    locked_spec: LockedSpec,
    treatment: str,
    outcome: str,
) -> IdentificationResult | RefusalResult:
```

**Behaviour:** Runs integrity check, then tries in order: backdoor adjustment, frontdoor mediator, instrumental variable, in-house ID algorithm. Returns the first successful **IdentificationResult** or a **RefusalResult** if not identifiable.

**Refusals:**

- Integrity failure → `RefusalReasonCode.LOCKED_SPEC_INTEGRITY_FAIL`.
- Missing treatment/outcome → `RefusalReasonCode.INPUT_INVALID`.
- Effect not identifiable → `RefusalReasonCode.NOT_IDENTIFIABLE` with checklist and suggested_next_steps.

**IdentificationResult** fields (among others): `provenance`, `method` (e.g. `"backdoor"`, `"frontdoor"`, `"iv"`), `estimand_expression`, `assumptions_used`, `witnesses`, `proof`, `limitations`.

**Internal helpers:** `find_backdoor_adjustment_set`, `find_frontdoor_mediator` (uses `locked_spec.roles.mediators`), `find_instrument` (uses `locked_spec.roles.instruments`), `id_algorithm` (graph-based ID).

---

## estimate_effect_dowhy

**Module:** `crca_core.core.estimate`

```python
class EstimatorConfig(BaseModel):
    method_name: str = "backdoor.linear_regression"
    test_significance: bool = True
    confidence_intervals: bool = True
    refuters: List[str] = ["placebo_treatment_refuter", "random_common_cause", "subset_refuter"]

def estimate_effect_dowhy(
    *,
    data: Any,
    locked_spec: LockedSpec,
    treatment: str,
    outcome: str,
    identification_result: IdentificationResult | None = None,
    config: Optional[EstimatorConfig] = None,
) -> EstimateResult | RefusalResult:
```

**Behaviour:** Asserts LockedSpec integrity, then uses DoWhy to build a causal model from the spec’s graph, identify the effect (or use provided `identification_result`), estimate, and optionally run refuters. Returns **EstimateResult** or **RefusalResult**.

**Refusals:**

- Integrity failure → `LOCKED_SPEC_INTEGRITY_FAIL`.
- Missing treatment/outcome → `INPUT_INVALID`.
- DoWhy/backend failures surface as refusals or exceptions as appropriate.

**EstimateResult** carries provenance, point estimate, confidence intervals when requested, and refutation results. Refuters are diagnostics, not proofs of causality.

**Note:** The module patches NetworkX for DoWhy compatibility when needed (`_ensure_networkx_compat`). The graph is converted to DOT from `locked_spec.graph` for DoWhy.
