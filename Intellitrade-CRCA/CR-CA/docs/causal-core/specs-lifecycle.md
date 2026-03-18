# Specs and lifecycle

**Where it lives:** `crca_core.models.spec`, `crca_core.core.lifecycle`, `crca_core.integrity`

The causal core uses a strict **draft → locked** lifecycle. Only a **LockedSpec** may be used for numeric causal outputs (identification, estimation, counterfactuals). DraftSpec is the editable form; locking hashes the structural payload and records approvals.

---

## Types (`crca_core.models.spec`)

### DraftSpec

Draft specification; may be LLM-generated. **Never** used for numeric causal outputs.

```python
class DraftSpec(BaseModel):
    status: SpecStatus = SpecStatus.draft  # frozen
    data: DataSpec
    graph: CausalGraphSpec
    roles: RoleSpec
    assumptions: AssumptionSpec
    scm: Optional[SCMSpec] = None
    draft_notes: Optional[str] = None
```

- **data**: `DataSpec` (columns, time_index, entity_index, etc.).
- **graph**: `CausalGraphSpec` (nodes, edges, latent_confounders).
- **roles**: `RoleSpec` (treatments, outcomes, mediators, instruments, adjustment_candidates, prohibited_controls).
- **assumptions**: `AssumptionSpec` (items with status: declared/contested/violated/unknown).
- **scm**: Optional `SCMSpec` (required for counterfactuals; linear_gaussian with equations and intervention_semantics).

### LockedSpec

Locked spec; **authoritative** for identification, estimation, and simulation.

```python
class LockedSpec(BaseModel):
    status: SpecStatus = SpecStatus.locked  # frozen
    spec_hash: str
    approvals: List[str]
    locked_at_utc: str
    data: DataSpec
    graph: CausalGraphSpec
    roles: RoleSpec
    assumptions: AssumptionSpec
    scm: Optional[SCMSpec] = None
```

- **spec_hash**: Canonical hash of structural payload (data, graph, roles, assumptions, scm).
- **approvals**: Non-empty list of approval labels (human or programmatic).

### Key nested types

- **StructuralEquationSpec**: `variable`, `parents`, `form` (e.g. `"linear_gaussian"`), `coefficients`, `intercept`, `noise`.
- **SCMSpec**: `scm_type`, `equations`, `noise_cov` (optional), `intervention_semantics` (var → `"set"` / etc.).

---

## Lifecycle: lock_spec

**Module:** `crca_core.core.lifecycle`

```python
def lock_spec(draft: DraftSpec, approvals: List[str]) -> LockedSpec:
```

- **Args:** `draft` (DraftSpec), `approvals` (non-empty list).
- **Returns:** LockedSpec with `spec_hash` from canonical payload, `locked_at_utc` in ISO format.
- **Raises:** `ValueError` if `approvals` is empty.

Canonical payload is built from `data`, `graph`, `roles`, `assumptions`, `scm` only (see integrity).

---

## Integrity (`crca_core.integrity`)

All numeric entry points must verify LockedSpec integrity before use.

### Payload and hash

- **locked_payload_from_draft(draft)** → dict of canonical structural fields (for hashing).
- **locked_payload_from_locked(locked_spec)** → same for a LockedSpec.
- **compute_locked_payload_hash(payload)** → stable string hash.
- **compute_locked_spec_hash(locked_spec)** → recompute hash from current payload.

### Verification

```python
def verify_locked_spec_integrity(locked_spec: LockedSpec) -> Tuple[bool, str | None]:
    # Returns (True, None) if spec_hash matches recomputed hash and approvals non-empty;
    # (False, error_message) otherwise.
```

```python
def assert_locked_spec_integrity(locked_spec: LockedSpec) -> None:
    # Raises ValueError if verification fails.
```

Call **assert_locked_spec_integrity(locked_spec)** at the start of any causal operation that uses a LockedSpec.

---

## Validation (structural checks)

**Module:** `crca_core.models.validation`

```python
def validate_spec(spec: DraftSpec | LockedSpec) -> ValidationReport:
```

- **Errors:** Edge source/target not in nodes; time_index column not in data columns.
- **Warnings:** Role variables (treatments, outcomes, etc.) not in graph nodes.
- **ValidationReport:** `ok: bool`, `errors: List[ValidationIssue]`, `warnings: List[ValidationIssue]`.

Validation is conservative and does not authorize numeric outputs; locking does.
