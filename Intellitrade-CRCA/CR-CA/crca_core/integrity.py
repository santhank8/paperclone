"""Locked-spec integrity helpers.

The locked spec hash must be a canonical digest of structural payload fields.
All numeric causal entry points must verify this hash before execution.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple

from crca_core.models.spec import DraftSpec, LockedSpec
from utils.canonical import stable_hash


def _locked_payload_dict(
    *,
    data: Any,
    graph: Any,
    roles: Any,
    assumptions: Any,
    scm: Any,
) -> Dict[str, Any]:
    return {
        "data": data.model_dump(),
        "graph": graph.model_dump(),
        "roles": roles.model_dump(),
        "assumptions": assumptions.model_dump(),
        "scm": scm.model_dump() if scm is not None else None,
    }


def locked_payload_from_draft(draft: DraftSpec) -> Dict[str, Any]:
    """Canonical payload fields that define immutable structural content."""
    return _locked_payload_dict(
        data=draft.data,
        graph=draft.graph,
        roles=draft.roles,
        assumptions=draft.assumptions,
        scm=draft.scm,
    )


def locked_payload_from_locked(locked_spec: LockedSpec) -> Dict[str, Any]:
    """Canonical payload fields for locked-spec integrity verification."""
    return _locked_payload_dict(
        data=locked_spec.data,
        graph=locked_spec.graph,
        roles=locked_spec.roles,
        assumptions=locked_spec.assumptions,
        scm=locked_spec.scm,
    )


def compute_locked_payload_hash(payload: Dict[str, Any]) -> str:
    """Stable hash of canonical locked payload."""
    return stable_hash(payload)


def compute_locked_spec_hash(locked_spec: LockedSpec) -> str:
    """Recompute hash from canonical locked payload fields."""
    return compute_locked_payload_hash(locked_payload_from_locked(locked_spec))


def verify_locked_spec_integrity(locked_spec: LockedSpec) -> Tuple[bool, str | None]:
    """Verify locked-spec payload hash and lock metadata baseline."""
    if not locked_spec.spec_hash:
        return False, "LockedSpec integrity failure: missing spec_hash."
    if not locked_spec.approvals:
        return False, "LockedSpec integrity failure: approvals are required."
    recomputed = compute_locked_spec_hash(locked_spec)
    if recomputed != locked_spec.spec_hash:
        return (
            False,
            "LockedSpec integrity failure: structural payload does not match locked spec_hash.",
        )
    return True, None


def assert_locked_spec_integrity(locked_spec: LockedSpec) -> None:
    """Raise ValueError when integrity checks fail."""
    ok, err = verify_locked_spec_integrity(locked_spec)
    if not ok:
        raise ValueError(err or "LockedSpec integrity failure.")
