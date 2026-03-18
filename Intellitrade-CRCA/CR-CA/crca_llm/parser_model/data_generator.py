"""Procedural synthetic data generator: unlimited (prompt, equations) pairs.

No LLM. Samples equation structures (chains, forks, DAGs), variable names,
coefficients, intercepts, and many surface-form variants. Use to fill data
to the brim for training.
"""

from __future__ import annotations

import json
import random
from typing import Any, Dict, List, Tuple

# Variable name pools (pick one pool per generated sample)
_VAR_POOLS = [
    ["X", "Y", "Z"],
    ["A", "B", "C"],
    ["M", "X", "Y"],
    ["W", "X", "Y", "Z"],
    ["X1", "X2", "X3"],
    ["X1", "X2", "X3", "X4"],
    ["Treatment", "Outcome"],
    ["Treatment", "Mediator", "Outcome"],
    ["Price", "Demand"],
    ["Price", "Income", "Demand"],
    ["Sales", "Price", "Ads", "Demand"],
    ["Income", "Education", "Wage"],
    ["P", "Q", "R"],
    ["L", "M", "N"],
    ["U", "V", "W"],
]

# Coefficient options (simple and decimal)
_COEFFS = [-2.0, -1.5, -1.0, -0.5, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
_COEFFS_EXTRA = [0.25, 0.33, 0.75, -0.25, -0.33]

# Prefixes for prompt text
_PREFIXES = [
    "",
    "Extract structural equations from:\n",
    "Parse the SCM:\n",
    "Here are the equations: ",
    "Structural equations: ",
    "SCM: ",
    "Linear model: ",
    "The model is: ",
    "Consider: ",
    "Equations:\n",
    "1) ", "2) ", "- ", "* ", "• ",
]

# Delimiters between equations
_DELIMS = ["; ", "\n", ", ", " and ", ". ", " | "]

# Format variants for one equation "X = 2*Y + U_X"
def _fmt_eq(eq: Dict[str, Any], style: int) -> str:
    v = eq["variable"]
    parents = eq.get("parents") or []
    coeffs = eq.get("coefficients") or {}
    inter = eq.get("intercept", 0.0)
    if not parents:
        return f"{v} = U_{v}"
    parts = []
    for p in parents:
        c = coeffs.get(p, 0.0)
        if style == 0:
            parts.append(f"{c}*{p}")
        elif style == 1 and c == 1.0:
            parts.append(p)
        elif style == 1:
            parts.append(f"{c}*{p}")
        elif style == 2:
            parts.append(f"{c}*{p}" if c != 1.0 else p)
        else:
            parts.append(f"{c}*{p}")
    rhs = " + ".join(parts)
    if inter != 0:
        rhs += f" + {inter}"
    rhs += f" + U_{v}"
    if style == 4:  # no space around =
        return f"{v}={rhs}"
    return f"{v} = {rhs}"


def _exo(var: str) -> Dict[str, Any]:
    return {"variable": var, "parents": [], "coefficients": {}, "intercept": 0.0}


def _endo(var: str, parents: List[str], coeffs: Dict[str, float], intercept: float = 0.0) -> Dict[str, Any]:
    return {"variable": var, "parents": parents, "coefficients": coeffs, "intercept": intercept}


def _random_coeff() -> float:
    if random.random() < 0.3:
        return random.choice(_COEFFS_EXTRA)
    return random.choice(_COEFFS)


def _random_intercept() -> float:
    if random.random() < 0.7:
        return 0.0
    return float(random.randint(0, 15))


def _shape_chain(vars: List[str], length: int) -> List[Dict[str, Any]]:
    eqs = [_exo(vars[0])]
    for i in range(1, min(length, len(vars))):
        c = _random_coeff()
        eqs.append(_endo(vars[i], [vars[i - 1]], {vars[i - 1]: c}, _random_intercept()))
    return eqs


def _shape_fork(parents: List[str], child: str) -> List[Dict[str, Any]]:
    eqs = [_exo(p) for p in parents]
    coeffs = {p: _random_coeff() for p in parents}
    eqs.append(_endo(child, parents, coeffs, _random_intercept()))
    return eqs


def _shape_confounder(conf: str, x: str, y: str) -> List[Dict[str, Any]]:
    eqs = [_exo(conf), _endo(x, [conf], {conf: _random_coeff()}, _random_intercept())]
    eqs.append(_endo(y, [conf, x], {conf: _random_coeff(), x: _random_coeff()}, _random_intercept()))
    return eqs


def _shape_dag(vars: List[str], n_edges: int) -> List[Dict[str, Any]]:
    n = len(vars)
    eqs = [_exo(vars[0])]
    for i in range(1, n):
        n_parents = random.randint(0, min(i, 3))
        parents = random.sample(vars[:i], n_parents) if n_parents else []
        if not parents:
            eqs.append(_exo(vars[i]))
        else:
            coeffs = {p: _random_coeff() for p in parents}
            eqs.append(_endo(vars[i], parents, coeffs, _random_intercept()))
    return eqs


def _equations_to_text(equations: List[Dict[str, Any]], delim: str, fmt_style: int) -> str:
    parts = [_fmt_eq(eq, fmt_style) for eq in equations]
    return delim.join(parts)


def generate_one(seed: int | None = None) -> Tuple[str, List[Dict[str, Any]]]:
    """Generate one (prompt_text, equations_list) pair. Infinite variety."""
    if seed is not None:
        random.seed(seed)
    pool = random.choice(_VAR_POOLS)
    n = len(pool)
    shape = random.choice(["chain", "chain", "fork", "confounder", "dag", "dag"])
    if shape == "chain":
        length = random.randint(2, min(4, n))
        vars_used = pool[:length] if length <= n else (pool + ["Z", "W"])[:length]
        equations = _shape_chain(vars_used, length)
    elif shape == "fork":
        n_parents = random.randint(1, min(3, n - 1))
        parents = pool[:n_parents]
        child = pool[n_parents] if n_parents < n else "Y"
        equations = _shape_fork(parents, child)
    elif shape == "confounder" and n >= 3:
        equations = _shape_confounder(pool[0], pool[1], pool[2])
    else:
        k = random.randint(2, min(5, n))
        vars_used = pool[:k] if k <= n else (pool + ["V1", "V2"])[:k]
        equations = _shape_dag(vars_used, k * 2)
    delim = random.choice(_DELIMS)
    fmt_style = random.randint(0, 4)
    text = _equations_to_text(equations, delim, fmt_style)
    prefix = random.choice(_PREFIXES)
    if prefix and not prefix.endswith("\n") and not prefix.endswith(" "):
        text = prefix + text
    else:
        text = prefix + text
    return text.strip(), equations


def generate_many(count: int, seed: int | None = None) -> List[Tuple[str, List[Dict[str, Any]]]]:
    """Generate count (prompt, equations) pairs. Each uses different random state."""
    out = []
    for i in range(count):
        s = (seed + i) if seed is not None else None
        out.append(generate_one(s))
    return out


def save_json(pairs: List[Tuple[str, List[Dict[str, Any]]]], path: str) -> None:
    """Save list of (text, equations) to JSON array of {input, equations}."""
    data = [{"input": text, "equations": eqs} for text, eqs in pairs]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=0, ensure_ascii=False)


def load_json(path: str) -> List[Tuple[str, List[Dict[str, Any]]]]:
    """Load from JSON. Returns list of (input, equations)."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [(item["input"], item["equations"]) for item in data]
