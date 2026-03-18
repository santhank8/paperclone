"""Spec lifecycle: DraftSpec → LockedSpec.

The LockedSpec is a scientific boundary: only LockedSpec may be used for numeric
causal outputs. This module enforces that boundary.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from crca_core.integrity import compute_locked_payload_hash, locked_payload_from_draft
from crca_core.models.spec import DraftSpec, LockedSpec


def lock_spec(draft: DraftSpec, approvals: List[str]) -> LockedSpec:
    """Lock a draft spec by hashing its canonical content and recording approvals.

    Args:
        draft: The draft specification (possibly LLM-generated).
        approvals: Human (or explicit programmatic) approvals. Must be non-empty.

    Returns:
        LockedSpec

    Raises:
        ValueError: If approvals are empty.
    """

    if not approvals:
        raise ValueError("approvals must be non-empty to lock a spec")

    # Canonicalize only over structural payload fields.
    draft_payload = locked_payload_from_draft(draft)
    spec_hash = compute_locked_payload_hash(draft_payload)
    locked_at = datetime.now(timezone.utc).isoformat()

    return LockedSpec(
        spec_hash=spec_hash,
        approvals=list(approvals),
        locked_at_utc=locked_at,
        data=draft.data.model_copy(deep=True),
        graph=draft.graph.model_copy(deep=True),
        roles=draft.roles.model_copy(deep=True),
        assumptions=draft.assumptions.model_copy(deep=True),
        scm=draft.scm.model_copy(deep=True) if draft.scm is not None else None,
    )

