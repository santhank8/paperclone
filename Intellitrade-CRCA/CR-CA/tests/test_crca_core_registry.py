import pytest

from crca_core import DraftSpec, create_registry_from_lock, lock_spec
from crca_core.models.spec import (
    CausalGraphSpec,
    EdgeSpec,
    NodeSpec,
    RoleSpec,
    SCMSpec,
    StructuralEquationSpec,
)


def _draft_with_scm(scm: SCMSpec) -> DraftSpec:
    return DraftSpec(
        graph=CausalGraphSpec(
            nodes=[NodeSpec(name="X"), NodeSpec(name="Y")],
            edges=[EdgeSpec(source="X", target="Y")],
        ),
        roles=RoleSpec(treatments=["X"], outcomes=["Y"]),
        scm=scm,
    )


def test_registry_does_not_expose_mutable_internal_structures() -> None:
    scm = SCMSpec(
        scm_type="linear_gaussian",
        equations=[
            StructuralEquationSpec(variable="X", parents=[], coefficients={}, intercept=0.0),
            StructuralEquationSpec(variable="Y", parents=["X"], coefficients={"X": 2.0}, intercept=0.0),
        ],
    )
    locked = lock_spec(_draft_with_scm(scm), approvals=["human"])
    registry = create_registry_from_lock(locked)

    spec_copy = registry.locked_spec
    spec_copy.scm.equations[1].coefficients["X"] = 99.0
    equations_copy = registry.get_equations()
    equations_copy[1].coefficients["X"] = -7.0

    assert registry.get_coefficients() == {("X", "Y"): 2.0}


def test_registry_explicitly_fails_on_invalid_scm() -> None:
    invalid_scm = SCMSpec(
        scm_type="linear_gaussian",
        equations=[
            StructuralEquationSpec(variable="X", parents=[], coefficients={}, intercept=0.0),
            StructuralEquationSpec(variable="X", parents=[], coefficients={}, intercept=1.0),
        ],
    )
    locked = lock_spec(_draft_with_scm(invalid_scm), approvals=["human"])
    with pytest.raises(ValueError):
        create_registry_from_lock(locked)
