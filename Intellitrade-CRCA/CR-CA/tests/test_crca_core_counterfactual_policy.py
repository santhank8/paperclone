from crca_core import DraftSpec, lock_spec, simulate_counterfactual
from crca_core.models.refusal import RefusalReasonCode, RefusalResult
from crca_core.models.result import CounterfactualResult
from crca_core.models.spec import (
    CausalGraphSpec,
    EdgeSpec,
    NodeSpec,
    RoleSpec,
    SCMSpec,
    StructuralEquationSpec,
)


def _draft_with_scm(*, intervention_semantics: dict[str, str] | None = None) -> DraftSpec:
    return DraftSpec(
        graph=CausalGraphSpec(
            nodes=[NodeSpec(name="X"), NodeSpec(name="Y")],
            edges=[EdgeSpec(source="X", target="Y")],
        ),
        roles=RoleSpec(treatments=["X"], outcomes=["Y"]),
        scm=SCMSpec(
            scm_type="linear_gaussian",
            equations=[
                StructuralEquationSpec(variable="X", parents=[], coefficients={}, intercept=0.0),
                StructuralEquationSpec(
                    variable="Y",
                    parents=["X"],
                    coefficients={"X": 2.0},
                    intercept=0.0,
                ),
            ],
            intervention_semantics=intervention_semantics or {"X": "set"},
        ),
    )


def test_counterfactual_refuses_when_locked_payload_mutates_after_lock() -> None:
    locked = lock_spec(_draft_with_scm(), approvals=["human"])
    locked.scm.equations[1].coefficients["X"] = 3.0

    res = simulate_counterfactual(
        locked_spec=locked,
        factual_observation={"X": 1.0, "Y": 3.0},
        intervention={"X": 2.0},
    )
    assert isinstance(res, RefusalResult)
    assert RefusalReasonCode.LOCKED_SPEC_INTEGRITY_FAIL in res.reason_codes


def test_counterfactual_set_semantics_and_world_separation_work() -> None:
    locked = lock_spec(_draft_with_scm(intervention_semantics={"X": "set"}), approvals=["human"])
    res = simulate_counterfactual(
        locked_spec=locked,
        factual_observation={"X": 1.0, "Y": 3.0},
        intervention={"X": 2.0},
    )
    assert isinstance(res, CounterfactualResult)
    assert res.counterfactual["result"]["Y"] == 5.0
    assert res.factual_world is not None
    assert res.counterfactual_world is not None
    assert res.factual_world["abduced_u"] == res.counterfactual_world["abduced_u"]


def test_counterfactual_refuses_unsupported_intervention_semantics() -> None:
    locked = lock_spec(_draft_with_scm(intervention_semantics={"X": "shift"}), approvals=["human"])
    res = simulate_counterfactual(
        locked_spec=locked,
        factual_observation={"X": 1.0, "Y": 3.0},
        intervention={"X": 2.0},
    )
    assert isinstance(res, RefusalResult)
    assert RefusalReasonCode.UNSUPPORTED_OPERATION in res.reason_codes
