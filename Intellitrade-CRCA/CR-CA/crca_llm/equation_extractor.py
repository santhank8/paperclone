"""Light-LLM / CPU-friendly extraction of structural equations from prompt text.

Runs when CRCA_PARSER_MODEL is set, or when the default local model exists at
package_root/crca_parser_model (train with: python3 -m crca_llm.parser_model.train).
Use CRCA_PARSER_MODEL=local:/path to override. When no model is available,
callers use regex parsing (0 params).
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from loguru import logger

from crca_llm.client import MissingApiKeyError, OpenAIClient

def _is_local_parser_dir(value: str) -> bool:
    try:
        p = Path(value).resolve()
        return p.is_dir() and (p / "model.pt").exists()
    except Exception:
        return False


def _default_local_parser_path() -> Path | None:
    """Default path for the trained parser: package_root/crca_parser_model. Used when CRCA_PARSER_MODEL is unset."""
    try:
        # equation_extractor.py lives in CR-CA/crca_llm/; package root = parents[1]
        pkg_root = Path(__file__).resolve().parents[1]
        default = pkg_root / "crca_parser_model"
        if default.is_dir() and (default / "model.pt").exists():
            return default
    except Exception:
        pass
    return None


def _extract_with_local_model(model_dir: str | Path, text: str) -> List[Dict[str, Any]] | None:
    """Run custom sub-0.1B parser model; returns raw equations list or None."""
    try:
        from crca_llm.parser_model.inference import _load_and_predict
        return _load_and_predict(model_dir, text)
    except Exception as exc:
        logger.debug("equation_extractor_local_failed path={} error={}", model_dir, exc)
        return None


_PARSER_SYSTEM = """You extract structural equations for a linear Gaussian SCM from the user's text.
Output JSON only. Use this exact shape:
{"equations": [{"variable": "X", "parents": [], "coefficients": {}, "intercept": 0.0}, ...]}
- variable: one string (LHS of equation).
- parents: list of parent variable names (empty for exogenous).
- coefficients: object mapping each parent to a number (e.g. {"X": 2.0}).
- intercept: number (default 0.0).
Exogenous: variable with no parents -> parents=[], coefficients={}, intercept=0.0.
Linear: Y = 2*X + U_Y -> variable "Y", parents ["X"], coefficients {"X": 2.0}, intercept 0.0.
Output only valid JSON with an "equations" key. No commentary."""


def _coerce_float(x: Any) -> float | None:
    """Coerce int/float/string to float; return None on failure."""
    if x is None:
        return 0.0
    if isinstance(x, (int, float)):
        return float(x)
    try:
        return float(str(x).strip())
    except (TypeError, ValueError):
        return None


def _normalize_llm_equations(raw: List[Dict[str, Any]]) -> List[Dict[str, Any]] | None:
    """Convert LLM output to list of equation dicts valid for parse_equation_item. Robust to missing keys and type drift."""
    out: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue  # Skip bad entries instead of failing whole list
        var = item.get("variable")
        if var is None:
            continue
        var = str(var).strip()
        if not var or (var[0] != "_" and not var[0].isalpha()):
            continue
        if var in seen:
            return None  # Duplicate variable invalidates SCM
        seen.add(var)
        parents_raw = item.get("parents") if "parents" in item else item.get("parent", [])
        if not isinstance(parents_raw, list):
            parents_raw = [parents_raw] if parents_raw is not None else []
        parents = [str(p).strip() for p in parents_raw if str(p).strip()]
        coeffs_raw = item.get("coefficients", item.get("coeffs", {}))
        if not isinstance(coeffs_raw, dict):
            coeffs_raw = {}
        coefficients: Dict[str, float] = {}
        for k, v in coeffs_raw.items():
            k = str(k).strip()
            if not k:
                continue
            f = _coerce_float(v)
            if f is None:
                return None  # Unknown/symbolic parameter
            coefficients[k] = f
        intercept_val = _coerce_float(item.get("intercept", item.get("intercepts", 0.0)))
        if intercept_val is None:
            intercept_val = 0.0
        out.append({
            "variable": var,
            "parents": parents,
            "coefficients": coefficients,
            "intercept": intercept_val,
        })
    return out if out else None


def extract_structural_equations_llm(
    text: str,
    *,
    client: Optional[OpenAIClient] = None,
    model: Optional[str] = None,
) -> List[Dict[str, Any]] | None:
    """Use a sub-0.1B-parameter LLM to extract equation dicts from prompt text.

    Runs when CRCA_PARSER_MODEL is set, or when the default local model exists
    at package_root/crca_parser_model (trained with parser_model.train). The
    model must be sub-0.1B params (<100M). Use CRCA_PARSER_MODEL=local:/path to
    override. When no model is available, returns None and callers use regex.

    Args:
        text: Raw user message that may contain structural equations.
        client: Optional OpenAI-compatible client; if None, uses from_env().
        model: Optional model name; if None, uses CRCA_PARSER_MODEL only (no default).

    Returns:
        List of equation dicts (variable, parents, coefficients, intercept)
        compatible with parse_equations_to_scm, or None when parser model
        is unset, on failure, or missing API key.
    """
    model = model or os.environ.get("CRCA_PARSER_MODEL")
    # Resolve to local path: explicit local:... or default package path if env unset
    model_path: str | Path | None = None
    if model:
        if str(model).startswith("local:"):
            model_path = model[6:].strip()
        elif _is_local_parser_dir(model):
            model_path = model
    else:
        default = _default_local_parser_path()
        if default is not None:
            model_path = default
    if model_path is not None:
        equations = _extract_with_local_model(model_path, text)
        return _normalize_llm_equations(equations) if isinstance(equations, list) else None
    try:
        c = client or OpenAIClient.from_env()
    except Exception:
        return None
    try:
        c._require_key()
    except MissingApiKeyError:
        return None
    if not model:
        return None  # No model name in prod; tests pass model= explicitly
    messages = [
        {"role": "system", "content": _PARSER_SYSTEM},
        {"role": "user", "content": f"Extract structural equations from this text:\n\n{text}"},
    ]
    try:
        response = c.chat_completion(
            messages=messages,
            model=model,
            temperature=0.0,
            max_tokens=1024,
            response_format={"type": "json_object"},
        )
    except Exception as exc:
        logger.debug("equation_extractor_llm_failed model={} error={}", model, exc)
        return None
    try:
        data = json.loads(response)
    except json.JSONDecodeError:
        return None
    equations = data.get("equations")
    if not isinstance(equations, list):
        return None
    return _normalize_llm_equations(equations)
