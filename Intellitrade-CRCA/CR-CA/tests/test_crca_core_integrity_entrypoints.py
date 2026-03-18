from crca_core import DraftSpec, lock_spec
from crca_core.core.estimate import estimate_effect_dowhy
from crca_core.identify import identify_effect
from crca_core.models.refusal import RefusalReasonCode, RefusalResult
from crca_core.models.spec import (
    CausalGraphSpec,
    EdgeSpec,
    NodeSpec,
    RoleSpec,
    SCMSpec,
    StructuralEquationSpec,
)


def _mutated_locked_spec():
    draft = DraftSpec(
        graph=CausalGraphSpec(
            nodes=[NodeSpec(name="X"), NodeSpec(name="Y")],
            edges=[EdgeSpec(source="X", target="Y")],
        ),
        roles=RoleSpec(treatments=["X"], outcomes=["Y"]),
        scm=SCMSpec(
            scm_type="linear_gaussian",
            equations=[
                StructuralEquationSpec(variable="X", parents=[], coefficients={}, intercept=0.0),
                StructuralEquationSpec(variable="Y", parents=["X"], coefficients={"X": 2.0}, intercept=0.0),
            ],
        ),
    )
    locked = lock_spec(draft, approvals=["human"])
    locked.scm.equations[1].coefficients["X"] = 3.0
    return locked


def test_identify_refuses_on_locked_spec_integrity_failure() -> None:
    res = identify_effect(
        locked_spec=_mutated_locked_spec(),
        treatment="X",
        outcome="Y",
    )
    assert isinstance(res, RefusalResult)
    assert RefusalReasonCode.LOCKED_SPEC_INTEGRITY_FAIL in res.reason_codes


def test_estimate_refuses_on_locked_spec_integrity_failure() -> None:
    res = estimate_effect_dowhy(
        data=None,
        locked_spec=_mutated_locked_spec(),
        treatment="X",
        outcome="Y",
        identification_result=None,
    )
    assert isinstance(res, RefusalResult)
    assert RefusalReasonCode.LOCKED_SPEC_INTEGRITY_FAIL in res.reason_codes
