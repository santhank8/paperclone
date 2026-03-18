# Counterfactuals and SCM

**Where it lives:** `crca_core.core.api`, `crca_core.scm.linear_gaussian`, `crca_core.kernel`, `crca_core.validation.consistency`

Counterfactual simulation requires an **explicit SCM** (structural equations + noise). The public entry point is **simulate_counterfactual**; execution uses **LinearGaussianSCM** (abduction–action–prediction). The **kernel** provides low-level deterministic propagation; **verify_counterfactual_result** checks consistency.

---

## simulate_counterfactual

**Module:** `crca_core.core.api`

```python
def simulate_counterfactual(
    *,
    locked_spec: LockedSpec,
    factual_observation: Dict[str, float],
    intervention: Dict[str, float],
    allow_partial_observation: bool = False,
) -> CounterfactualResult | RefusalResult:
```

**Behaviour:**

1. Asserts LockedSpec integrity.
2. Refuses if `locked_spec.scm` is None (`RefusalReasonCode.NO_SCM_FOR_COUNTERFACTUAL`).
3. Builds `LinearGaussianSCM` from `locked_spec.scm`.
4. Checks intervention semantics: only `"set"` is supported for v1; unsupported → `UNSUPPORTED_OPERATION`.
5. Checks intervention keys are SCM variables; else `INPUT_INVALID`.
6. **Abduction:** `scm.abduce_noise(factual_observation, allow_partial=allow_partial_observation)`; on failure → `INPUT_INVALID`.
7. **Prediction:** `scm.predict(u, interventions=intervention)`.
8. Returns **CounterfactualResult** with counterfactual values and provenance.

**CounterfactualResult** extends BaseResult with the counterfactual variable→value mapping and provenance.

---

## LinearGaussianSCM

**Module:** `crca_core.scm.linear_gaussian`

```python
@dataclass(frozen=True)
class LinearGaussianSCM:
    variables: Tuple[str, ...]
    parents: Dict[str, Tuple[str, ...]]
    coefficients: Dict[Tuple[str, str], float]   # (parent, child) -> beta
    intercepts: Dict[str, float]
    noise_cov: Optional[np.ndarray] = None
```

- **from_spec(spec: SCMSpec)** → builds from `spec.equations`; validates acyclicity via topological order.
- **topological_order()** → list of variable names in topological order; raises if graph is not a DAG.
- **abduce_noise(factual_observation, allow_partial=False)** → infers exogenous noise U from observed endogenous values; raises ValueError if observation is invalid or incomplete (when allow_partial is False).
- **predict(u, interventions)** → propagates with do-interventions (set semantics): replaces structural equations for intervened variables and computes remaining in topological order.

v0.1 assumes additive Gaussian noise; optional `noise_cov` for correlated noise. Coefficients and structure come only from the locked spec (never from LLM output).

---

## Kernel (deterministic propagation)

**Module:** `crca_core.kernel`

Low-level helpers for one-step propagation; coefficients must come from the coefficient registry / spec, not from raw LLM output.

```python
def propagate_g(a: float, b: float, G_prev: float, R_prev: float, *, intercept: float = 0.0) -> float:
    # G_t = intercept + a*G_prev + b*R_prev

def propagate_linear(
    coefficients: dict[str, float],
    parent_values: dict[str, float],
    *,
    intercept: float = 0.0,
) -> float:
    # value = intercept + sum(coeff[p] * parent_values[p])
```

Used for time-step or single-variable deterministic structural steps; noise (U) is applied externally (e.g. in abduce-then-predict).

---

## verify_counterfactual_result

**Module:** `crca_core.validation.consistency`

```python
def verify_counterfactual_result(
    locked_spec: LockedSpec,
    factual_observation: Dict[str, float],
    intervention: Dict[str, float],
    counterfactual_result: Dict[str, float],
    *,
    tolerance: float = 1e-9,
) -> Tuple[bool, Optional[str]]:
```

Recomputes counterfactual via SCM abduction and prediction; compares with `counterfactual_result`. Returns `(True, None)` if within tolerance, else `(False, error_message)`.
