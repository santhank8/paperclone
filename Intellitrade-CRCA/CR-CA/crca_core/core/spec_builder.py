"""Equation proposal → parse → attach pipeline for SCM.

LLM or form proposes structural equations in a fixed format; parser produces
SCMSpec. Coefficients come from the proposal (or defaults). After attach,
draft can be locked; no further edits to coefficients after lock.
"""

from __future__ import annotations

from typing import Any, Dict, List

from crca_core.models.spec import (
    AssumptionSpec,
    CausalGraphSpec,
    DataSpec,
    DraftSpec,
    EdgeSpec,
    NodeSpec,
    NoiseSpec,
    RoleSpec,
    SCMSpec,
    StructuralEquationSpec,
)


def parse_equation_item(item: Dict[str, Any]) -> StructuralEquationSpec:
    """Parse a single equation proposal into StructuralEquationSpec.

    Expected keys: variable (str), parents (list of str), coefficients (dict
    parent -> float), intercept (float, default 0). Form is always linear_gaussian.

    Args:
        item: One equation as dict, e.g. {"variable": "Y", "parents": ["X"],
            "coefficients": {"X": 0.5}, "intercept": 1.0}.

    Returns:
        StructuralEquationSpec for linear_gaussian form.
    """
    variable = str(item.get("variable", "")).strip()
    if not variable:
        raise ValueError("Equation item must have non-empty 'variable'.")
    parents = list(item.get("parents", []))
    parents = [str(p).strip() for p in parents if str(p).strip()]
    raw_coeffs = item.get("coefficients", {})
    coefficients = {}
    for k, v in raw_coeffs.items():
        pk = str(k).strip()
        if pk:
            try:
                coefficients[pk] = float(v)
            except (TypeError, ValueError):
                coefficients[pk] = 0.0
    intercept = float(item.get("intercept", 0.0))
    return StructuralEquationSpec(
        variable=variable,
        parents=parents,
        form="linear_gaussian",
        coefficients=coefficients,
        intercept=intercept,
        noise=NoiseSpec(),
    )


def parse_equations_to_scm(equations: List[Dict[str, Any]]) -> SCMSpec:
    """Parse a list of equation proposals into an SCMSpec.

    Each item is a dict with variable, parents, coefficients, intercept.
    Validates no duplicate variable; builds linear_gaussian SCMSpec.

    Args:
        equations: List of equation dicts (see parse_equation_item).

    Returns:
        SCMSpec with scm_type linear_gaussian.

    Raises:
        ValueError: If any equation is invalid or duplicate variable.
    """
    seen: set[str] = set()
    specs: List[StructuralEquationSpec] = []
    for eq in equations:
        if not isinstance(eq, dict):
            raise ValueError(f"Each equation must be a dict; got {type(eq).__name__}.")
        spec = parse_equation_item(eq)
        if spec.variable in seen:
            raise ValueError(f"Duplicate equation for variable: {spec.variable}.")
        seen.add(spec.variable)
        specs.append(spec)
    return SCMSpec(scm_type="linear_gaussian", equations=specs)


def build_draft_with_scm(draft: DraftSpec, scm: SCMSpec) -> DraftSpec:
    """Return a new DraftSpec with the given SCM attached. Original unchanged."""
    return DraftSpec(
        data=draft.data,
        graph=draft.graph,
        roles=draft.roles,
        assumptions=draft.assumptions,
        scm=scm,
        draft_notes=draft.draft_notes,
    )


def propose_equations_and_attach(
    draft: DraftSpec,
    equations: List[Dict[str, Any]],
) -> DraftSpec:
    """Parse equation proposals and attach SCM to draft. One-step pipeline.

    Args:
        draft: Existing draft (graph, roles, etc.).
        equations: List of equation dicts (variable, parents, coefficients, intercept).

    Returns:
        New DraftSpec with scm set. Call lock_spec(draft, approvals) to commit.
    """
    scm = parse_equations_to_scm(equations)
    return build_draft_with_scm(draft, scm)


def draft_from_equations(equation_dicts: List[Dict[str, Any]]) -> DraftSpec:
    """Build a minimal DraftSpec from equation dicts (e.g. from prompt parser).

    Uses parse_equations_to_scm to get SCMSpec, builds graph from variables
    and parent-child relationships, and minimal data/roles/assumptions.

    Args:
        equation_dicts: List of equation dicts (variable, parents, coefficients, intercept).

    Returns:
        DraftSpec with graph and SCM set. Call lock_spec(draft, approvals) to commit.

    Raises:
        ValueError: If any equation is invalid or duplicate variable.
    """
    scm = parse_equations_to_scm(equation_dicts)
    nodes = [NodeSpec(name=eq.variable) for eq in scm.equations]
    edges = [
        EdgeSpec(source=parent, target=eq.variable)
        for eq in scm.equations
        for parent in eq.parents
    ]
    graph = CausalGraphSpec(nodes=nodes, edges=edges)
    return DraftSpec(
        data=DataSpec(),
        graph=graph,
        roles=RoleSpec(),
        assumptions=AssumptionSpec(),
        scm=scm,
        draft_notes="Auto-lock from prompt structural equations.",
    )
