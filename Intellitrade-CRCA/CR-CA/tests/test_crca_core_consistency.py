from crca_core import DraftSpec, lock_spec
from crca_core.models.spec import (
    CausalGraphSpec,
    EdgeSpec,
    NodeSpec,
    RoleSpec,
    SCMSpec,
    StructuralEquationSpec,
)
from crca_core.scm import LinearGaussianSCM
from crca_core.validation.consistency import verify_counterfactual_result


def _locked_spec() -> object:
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
    return lock_spec(draft, approvals=["human"])


def test_consistency_validator_rejects_tampered_result() -> None:
    locked = _locked_spec()
    ok, err = verify_counterfactual_result(
        locked,
        factual_observation={"X": 1.0, "Y": 3.0},
        intervention={"X": 2.0},
        counterfactual_result={"X": 2.0, "Y": 999.0},
    )
    assert ok is False
    assert err is not None and "Variable Y" in err


def test_consistency_validator_accepts_kernel_recompute() -> None:
    locked = _locked_spec()
    scm = LinearGaussianSCM.from_spec(locked.scm)
    u = scm.abduce_noise({"X": 1.0, "Y": 3.0})
    recomputed = scm.predict(u, interventions={"X": 2.0})

    ok, err = verify_counterfactual_result(
        locked,
        factual_observation={"X": 1.0, "Y": 3.0},
        intervention={"X": 2.0},
        counterfactual_result=recomputed,
    )
    assert ok is True
    assert err is None
