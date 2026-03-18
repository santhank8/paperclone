"""Coefficient Registry: immutable read-only view of locked structural state.

All numeric computation must read coefficients and structure from the registry,
never from conversation text. The registry is the single source of truth after
commit (lock). No mutators after construction.
"""

from __future__ import annotations

import copy
from typing import Dict, List, Optional, Tuple

from crca_core.integrity import assert_locked_spec_integrity
from crca_core.models.spec import LockedSpec, SCMSpec, StructuralEquationSpec
from crca_core.scm.linear_gaussian import LinearGaussianSCM


class CoefficientRegistry:
    """Immutable registry wrapping a LockedSpec (and optional built SCM).

    Exposes read-only access to nodes, edges, structural equations, and
    coefficients. All causal numeric code should use the registry (or
    LockedSpec) as input; never read coefficients from LLM/output text.

    After construction the registry is immutable—no mutators.
    """

    __slots__ = ("_locked_spec", "_scm", "_committed")

    def __init__(self, locked_spec: LockedSpec) -> None:
        """Build registry from a locked spec. Registry is immutable after this.

        Args:
            locked_spec: The locked specification. Must have non-empty approvals.
        """
        if not locked_spec.approvals:
            raise ValueError("CoefficientRegistry requires a LockedSpec with approvals (already locked).")
        # Keep an internal deep copy so external callers cannot mutate registry state.
        self._locked_spec: LockedSpec = locked_spec.model_copy(deep=True)
        assert_locked_spec_integrity(self._locked_spec)
        self._scm: Optional[LinearGaussianSCM] = None
        if self._locked_spec.scm is not None:
            # Refuse invalid SCM explicitly; do not silently degrade into a non-structural path.
            self._scm = LinearGaussianSCM.from_spec(self._locked_spec.scm)
        self._committed: bool = True

    @property
    def locked_spec(self) -> LockedSpec:
        """Return the underlying LockedSpec (read-only)."""
        return self._locked_spec.model_copy(deep=True)

    @property
    def spec_hash(self) -> str:
        """Canonical hash of the locked spec."""
        return self._locked_spec.spec_hash

    def get_nodes(self) -> List[str]:
        """Return node names from the graph (read-only)."""
        return [n.name for n in self._locked_spec.graph.nodes]

    def get_edges(self) -> List[Tuple[str, str]]:
        """Return edges as (source, target) pairs (read-only)."""
        return [(e.source, e.target) for e in self._locked_spec.graph.edges]

    def get_equations(self) -> List[StructuralEquationSpec]:
        """Return structural equation specs (read-only). Empty if no SCM."""
        if self._locked_spec.scm is None:
            return []
        return [eq.model_copy(deep=True) for eq in self._locked_spec.scm.equations]

    def get_coefficients(self) -> Dict[Tuple[str, str], float]:
        """Return (parent, child) -> coefficient. Empty if no SCM or SCM not linear_gaussian."""
        if self._scm is None:
            return {}
        return dict(self._scm.coefficients)

    def get_intercepts(self) -> Dict[str, float]:
        """Return variable -> intercept. Empty if no SCM."""
        if self._scm is None:
            return {}
        return dict(self._scm.intercepts)

    def get_parents(self) -> Dict[str, Tuple[str, ...]]:
        """Return variable -> tuple of parent names (read-only)."""
        if self._scm is None:
            return {}
        return dict(self._scm.parents)

    def get_scm_spec(self) -> Optional[SCMSpec]:
        """Return the SCM spec if present (read-only)."""
        if self._locked_spec.scm is None:
            return None
        return self._locked_spec.scm.model_copy(deep=True)

    def get_scm(self) -> Optional[LinearGaussianSCM]:
        """Return the built LinearGaussianSCM if SCM is linear_gaussian, else None."""
        if self._scm is None:
            return None
        return copy.deepcopy(self._scm)

    def has_scm(self) -> bool:
        """True if a linear_gaussian SCM is available for counterfactuals."""
        return self._scm is not None

    def __repr__(self) -> str:
        return f"CoefficientRegistry(spec_hash={self.spec_hash!r}, committed={self._committed})"


def create_registry_from_lock(locked_spec: LockedSpec) -> CoefficientRegistry:
    """Create an immutable CoefficientRegistry from an already-locked spec.

    Use after lock_spec(draft, approvals) to obtain the session-facing registry.
    """
    return CoefficientRegistry(locked_spec)
