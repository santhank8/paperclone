"""Synthetic data generation for equation parser: (prompt_text, equations_json).

Covers clean and messy inputs: experienced users (precise notation) and
inconsistent/typo-heavy/vague users. Model must generalize to both.
Use fill_synthetic_data.py to generate a huge JSON dataset; if that file
exists (or CRCA_SYNTHETIC_DATA_PATH), it is used. Otherwise mix of fixed
templates and procedural generator.
"""

from __future__ import annotations

import json
import os
import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Loaded from JSON when available (filled by fill_synthetic_data.py)
_CACHED_PAIRS: Optional[List[Tuple[str, List[Dict[str, Any]]]]] = None


def _default_synthetic_data_path() -> Path:
    return Path(__file__).resolve().parent / "synthetic_data.json"


def _load_cached_if_available() -> None:
    global _CACHED_PAIRS
    if _CACHED_PAIRS is not None:
        return
    path = os.environ.get("CRCA_SYNTHETIC_DATA_PATH") or str(_default_synthetic_data_path())
    if path and Path(path).is_file():
        try:
            from crca_llm.parser_model.data_generator import load_json
            _CACHED_PAIRS = load_json(path)
        except Exception:
            _CACHED_PAIRS = []
    if _CACHED_PAIRS is None:
        _CACHED_PAIRS = []

def _eq(var: str, parents: List[str], coeffs: Dict[str, float], intercept: float = 0.0) -> Dict[str, Any]:
    return {"variable": var, "parents": parents, "coefficients": coeffs, "intercept": intercept}


def _exo(var: str) -> Dict[str, Any]:
    return _eq(var, [], {}, 0.0)


# ---- Clean, standard notation ----
_CLEAN = [
    ("Structural equations: X = U_X; Y = 2*X + U_Y.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("SCM: A = U_A, B = 0.5*A + U_B.", [_exo("A"), _eq("B", ["A"], {"A": 0.5})]),
    ("X = U_X\nY = 2*X + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("Linear SCM: Z = U_Z; Y = 3*Z + U_Y; X = 0.5*Y + U_X.", [_exo("Z"), _eq("Y", ["Z"], {"Z": 3.0}), _eq("X", ["Y"], {"Y": 0.5})]),
    ("Let X = U_X and Y = X + U_Y.", [_exo("X"), _eq("Y", ["X"], {"X": 1.0})]),
    ("M = U_M; X = U_X; Y = 2*X + 0.5*M + U_Y.", [_exo("M"), _exo("X"), _eq("Y", ["X", "M"], {"X": 2.0, "M": 0.5})]),
    ("A = U_A\nB = 2*A + U_B\nC = B + 3*A + U_C", [_exo("A"), _eq("B", ["A"], {"A": 2.0}), _eq("C", ["B", "A"], {"B": 1.0, "A": 3.0})]),
    ("W = U_W; X = U_X; Y = W + X + U_Y; Z = 0.5*Y + U_Z.", [_exo("W"), _exo("X"), _eq("Y", ["W", "X"], {"W": 1.0, "X": 1.0}), _eq("Z", ["Y"], {"Y": 0.5})]),
    ("Treatment = U_Treatment; Outcome = 1.5*Treatment + U_Outcome.", [_exo("Treatment"), _eq("Outcome", ["Treatment"], {"Treatment": 1.5})]),
    ("Price = U_Price\nDemand = -0.8*Price + 10 + U_Demand", [_exo("Price"), _eq("Demand", ["Price"], {"Price": -0.8}, 10.0)]),
    ("X=U_X,Y=2*X+U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("P = U_P; Q = 2*P + 1 + U_Q.", [_exo("P"), _eq("Q", ["P"], {"P": 2.0}, 1.0)]),
]

# ---- Verbose / narrative ----
_VERBOSE = [
    ("The structural model is as follows. X is exogenous: X = U_X. Y depends on X: Y = 2*X + U_Y.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("We have two equations. First, X equals U_X. Second, Y equals 2 times X plus U_Y.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("Extract structural equations from:\nX = U_X; Y = 2*X + U_Y.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("Here is my SCM. Variable A is exogenous: A = U_A. B is given by B = 0.5*A + U_B.", [_exo("A"), _eq("B", ["A"], {"A": 0.5})]),
    ("Consider the following causal model. X = U_X. Y = 2*X + U_Y. That's it.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("I'm defining a linear Gaussian SCM. Let X = U_X and Y = 2*X + U_Y.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("The equations are: X = U_X; Y = 2*X + U_Y. Please use these for counterfactuals.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("My model: A = U_A, B = 0.5*A + U_B. Both are linear.", [_exo("A"), _eq("B", ["A"], {"A": 0.5})]),
]

# ---- Messy / typo / inconsistent ----
_MESSY = [
    ("x = U_x   y = 2*x + U_y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),  # lowercase vars
    ("X = U_X  Y = 2X + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),   # 2X no asterisk
    ("X=U_X;Y=2*X+U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("X equals U_X, Y equals 2 times X plus U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("X = U_X  ,  Y = 2 * X + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("A = U_A. B = .5*A + U_B", [_exo("A"), _eq("B", ["A"], {"A": 0.5})]),
    ("so we have X = U_X and Y = 2*X + U_Y ok", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("structural eqs: X=U_X; Y=2X+U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("X is U_X, Y is 2*X plus U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("A=U_A  B=0.5*A+U_B", [_exo("A"), _eq("B", ["A"], {"A": 0.5})]),
    ("M=U_M; X=U_X; Y=2*X+0.5*M+U_Y", [_exo("M"), _exo("X"), _eq("Y", ["X", "M"], {"X": 2.0, "M": 0.5})]),
    ("Z = U_Z, Y = 3*Z + U_Y, X = 0.5*Y + U_X", [_exo("Z"), _eq("Y", ["Z"], {"Z": 3.0}), _eq("X", ["Y"], {"Y": 0.5})]),
    ("X = U_X  Y = 2 * X + U_Y  (linear)", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("eq1: X = U_X  eq2: Y = 2*X + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("(1) X = U_X (2) Y = 2*X + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("X= U_X ; Y= 2*X+ U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
]

# ---- Minimal / single or two eqs ----
_MINIMAL = [
    ("X = U_X", [_exo("X")]),
    ("A = U_A", [_exo("A")]),
    ("Y = 2*X + U_Y", [_eq("Y", ["X"], {"X": 2.0})]),
    ("X = U_X; Y = 2*X + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("A = U_A\nB = A + U_B", [_exo("A"), _eq("B", ["A"], {"A": 1.0})]),
    ("Z = U_Z", [_exo("Z")]),
]

# ---- Three or more variables ----
_LONG = [
    ("A = U_A; B = 2*A + U_B; C = B + A + U_C.", [_exo("A"), _eq("B", ["A"], {"A": 2.0}), _eq("C", ["B", "A"], {"B": 1.0, "A": 1.0})]),
    ("W = U_W; X = U_X; Y = W + X + U_Y; Z = Y + U_Z.", [_exo("W"), _exo("X"), _eq("Y", ["W", "X"], {"W": 1.0, "X": 1.0}), _eq("Z", ["Y"], {"Y": 1.0})]),
    ("X1 = U_X1; X2 = 0.5*X1 + U_X2; X3 = X1 + X2 + U_X3.", [_exo("X1"), _eq("X2", ["X1"], {"X1": 0.5}), _eq("X3", ["X1", "X2"], {"X1": 1.0, "X2": 1.0})]),
    ("M = U_M; X = U_X; Y = 2*X + 0.3*M + U_Y; Z = 0.1*Y + U_Z.", [_exo("M"), _exo("X"), _eq("Y", ["X", "M"], {"X": 2.0, "M": 0.3}), _eq("Z", ["Y"], {"Y": 0.1})]),
    ("A = U_A\nB = A + U_B\nC = 2*B + U_C\nD = C + A + U_D", [_exo("A"), _eq("B", ["A"], {"A": 1.0}), _eq("C", ["B"], {"B": 2.0}), _eq("D", ["C", "A"], {"C": 1.0, "A": 1.0})]),
]

# ---- With intercept ----
_INTERCEPT = [
    ("Y = 2*X + 1 + U_Y", [_eq("Y", ["X"], {"X": 2.0}, 1.0)]),
    ("B = 0.5*A + 10 + U_B", [_eq("B", ["A"], {"A": 0.5}, 10.0)]),
    ("X = U_X; Y = 2*X + 3 + U_Y.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0}, 3.0)]),
    ("Demand = -0.5*Price + 100 + U_Demand", [_eq("Demand", ["Price"], {"Price": -0.5}, 100.0)]),
    ("Outcome = 1.2*Treatment + 5 + U_Outcome", [_eq("Outcome", ["Treatment"], {"Treatment": 1.2}, 5.0)]),
]

# ---- Negative / decimal coefficients ----
_NEG_DECIMAL = [
    ("Y = -1*X + U_Y", [_eq("Y", ["X"], {"X": -1.0})]),
    ("B = -0.5*A + U_B", [_eq("B", ["A"], {"A": -0.5})]),
    ("Y = 2.5*X + U_Y", [_eq("Y", ["X"], {"X": 2.5})]),
    ("Y = 0.333*X + U_Y", [_eq("Y", ["X"], {"X": 0.333})]),
    ("Y = -2*X + 1 + U_Y", [_eq("Y", ["X"], {"X": -2.0}, 1.0)]),
]

# ---- Domain-style variable names ----
_DOMAIN = [
    ("Treatment = U_Treatment; Outcome = 2*Treatment + U_Outcome.", [_exo("Treatment"), _eq("Outcome", ["Treatment"], {"Treatment": 2.0})]),
    ("Mediator = U_Mediator; Outcome = 1.5*Mediator + U_Outcome.", [_exo("Mediator"), _eq("Outcome", ["Mediator"], {"Mediator": 1.5})]),
    ("Sales = U_Sales; Price = U_Price; Demand = -0.3*Price + 0.1*Sales + U_Demand.", [_exo("Sales"), _exo("Price"), _eq("Demand", ["Price", "Sales"], {"Price": -0.3, "Sales": 0.1})]),
    ("Income = U_Income; Education = U_Education; Wage = 0.1*Education + 0.05*Income + U_Wage.", [_exo("Income"), _exo("Education"), _eq("Wage", ["Education", "Income"], {"Education": 0.1, "Income": 0.05})]),
]

# ---- Vague-but-parseable ----
_VAGUE = [
    ("variable X is exogenous. Y depends on X with coefficient 2. So X = U_X, Y = 2*X + U_Y.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("X has no parents. Y = 2*X + noise. So X = U_X, Y = 2*X + U_Y.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("two vars: X exogenous, Y = 2*X + U_Y. So X = U_X.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
]

# ---- More messy / noisy ----
_MESSY2 = [
    ("idk maybe X = U_X and Y = 2*X + U_Y?", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("scm: x=u_x; y=2x+u_y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("X=U_X   Y=2*X+U_Y   thanks", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("A = U_A  B = 0.5 A + U_B", [_exo("A"), _eq("B", ["A"], {"A": 0.5})]),
    ("equations: 1) X = U_X 2) Y = 2*X + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("Model: X = U_X. Then Y = 2*X + U_Y.", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("- X = U_X\n- Y = 2*X + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("* X = U_X\n* Y = 2*X + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("• X = U_X • Y = 2*X + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("X:=U_X; Y:=2*X+U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("X ~ U_X, Y ~ 2*X + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
    ("[X] = U_X, [Y] = 2*[X] + U_Y", [_exo("X"), _eq("Y", ["X"], {"X": 2.0})]),
]

# ---- More chains and forks ----
_CHAINS = [
    ("A = U_A; B = A + U_B; C = B + U_C.", [_exo("A"), _eq("B", ["A"], {"A": 1.0}), _eq("C", ["B"], {"B": 1.0})]),
    ("X1 = U_X1; X2 = X1 + U_X2; X3 = 2*X2 + U_X3.", [_exo("X1"), _eq("X2", ["X1"], {"X1": 1.0}), _eq("X3", ["X2"], {"X2": 2.0})]),
    ("L = U_L; M = L + U_M; N = M + L + U_N.", [_exo("L"), _eq("M", ["L"], {"L": 1.0}), _eq("N", ["M", "L"], {"M": 1.0, "L": 1.0})]),
    ("P = U_P; Q = 2*P + U_Q; R = Q - P + U_R.", [_exo("P"), _eq("Q", ["P"], {"P": 2.0}), _eq("R", ["Q", "P"], {"Q": 1.0, "P": -1.0})]),
]

# ---- Confounder / collider ----
_CONFOUNDER = [
    ("U = U_U; X = U + U_X; Y = U + X + U_Y.", [_exo("U"), _eq("X", ["U"], {"U": 1.0}), _eq("Y", ["U", "X"], {"U": 1.0, "X": 1.0})]),
    ("C = U_C; X = C + U_X; Y = 2*X + 0.5*C + U_Y.", [_exo("C"), _eq("X", ["C"], {"C": 1.0}), _eq("Y", ["X", "C"], {"X": 2.0, "C": 0.5})]),
    ("M = U_M; X = M + U_X; Y = M + U_Y.", [_exo("M"), _eq("X", ["M"], {"M": 1.0}), _eq("Y", ["M"], {"M": 1.0})]),
]

# ---- Single parent variations ----
_ONE_PARENT = [
    ("Y = 3*X + U_Y", [_eq("Y", ["X"], {"X": 3.0})]),
    ("Y = X + U_Y", [_eq("Y", ["X"], {"X": 1.0})]),
    ("Y = 0.25*X + U_Y", [_eq("Y", ["X"], {"X": 0.25})]),
    ("B = 2*A + U_B", [_eq("B", ["A"], {"A": 2.0})]),
    ("Outcome = Treatment + U_Outcome", [_eq("Outcome", ["Treatment"], {"Treatment": 1.0})]),
]

# ---- Two parents ----
_TWO_PARENTS = [
    ("Y = X + Z + U_Y", [_eq("Y", ["X", "Z"], {"X": 1.0, "Z": 1.0})]),
    ("Y = 2*X + 3*Z + U_Y", [_eq("Y", ["X", "Z"], {"X": 2.0, "Z": 3.0})]),
    ("Y = 0.5*X + 0.5*Z + U_Y", [_eq("Y", ["X", "Z"], {"X": 0.5, "Z": 0.5})]),
    ("Sales = 0.1*Price + 0.2*Ads + U_Sales", [_eq("Sales", ["Price", "Ads"], {"Price": 0.1, "Ads": 0.2})]),
]

# ---- Combined mega list with optional prefix ----
def _build_templates() -> List[Tuple[str, List[Dict[str, Any]]]]:
    out: List[Tuple[str, List[Dict[str, Any]]]] = []
    for lst in [
        _CLEAN, _VERBOSE, _MESSY, _MINIMAL, _LONG, _INTERCEPT, _NEG_DECIMAL, _DOMAIN, _VAGUE,
        _MESSY2, _CHAINS, _CONFOUNDER, _ONE_PARENT, _TWO_PARENTS,
    ]:
        out.extend(lst)
    return out


_TEMPLATES = _build_templates()


def generate_synthetic_sample() -> Tuple[str, str]:
    """Return (prompt_text, equations_json_string). Uses cached JSON if set, else procedural + fixed."""
    _load_cached_if_available()
    if _CACHED_PAIRS:
        text, equations = random.choice(_CACHED_PAIRS)
        return text, json.dumps({"equations": equations})
    if random.random() < 0.75:
        from crca_llm.parser_model.data_generator import generate_one
        text, equations = generate_one()
        return text, json.dumps({"equations": equations})
    text, equations = random.choice(_TEMPLATES)
    if random.random() < 0.25:
        text = "Extract structural equations from:\n" + text
    elif random.random() < 0.12:
        text = "Parse the SCM:\n" + text
    elif random.random() < 0.08:
        text = "Here are the equations: " + text
    return text, json.dumps({"equations": equations})


def generate_synthetic_batch(size: int) -> List[Tuple[str, str]]:
    return [generate_synthetic_sample() for _ in range(size)]
