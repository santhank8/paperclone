"""Load custom parser model and predict equations JSON from text.

Robust to malformed JSON: trailing commas, bare arrays, multiple blobs,
encoding noise, and retries with different generation settings.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import torch
from loguru import logger

from crca_llm.parser_model.config import ParserModelConfig
from crca_llm.parser_model.model import ParserTransformer
from crca_llm.parser_model.tokenizer import ParserTokenizer

PROMPT_PREFIX = "Extract equations.\n\nInput: "
OUTPUT_PREFIX = "\n\nOutput: "  # trailing space so model predicts '{' not ':'

# Try up to this many generation attempts with different settings
_MAX_PREDICT_ATTEMPTS = 4


def load_parser_model(model_dir: str | Path) -> tuple[ParserTransformer, ParserTokenizer]:
    """Load checkpoint and tokenizer from a directory."""
    model_dir = Path(model_dir)
    ckpt = torch.load(model_dir / "model.pt", map_location="cpu", weights_only=False)
    raw = ckpt.get("config")
    if raw is None:
        config = ParserModelConfig()
    elif isinstance(raw, dict):
        config = ParserModelConfig(**{k: raw[k] for k in ["vocab_size", "max_length", "n_layer", "n_embd", "n_head", "dropout"] if k in raw})
    else:
        config = raw
    tokenizer = ParserTokenizer.load(model_dir / "tokenizer.json")
    model = ParserTransformer(config)
    model.load_state_dict(ckpt["state_dict"], strict=True)
    model.eval()
    return model, tokenizer


def _repair_json(s: str) -> str:
    """Try to fix common JSON invalidities without changing semantics."""
    s = s.strip()
    # Remove trailing commas before ] or }
    s = re.sub(r",\s*]", "]", s)
    s = re.sub(r",\s*}", "}", s)
    # Replace single-quoted strings with double-quoted (naive: only outside strings)
    # Unescape unescaped newlines inside strings (skip for now; balanced extract helps)
    return s


def _extract_balanced(s: str, open_c: str, close_c: str, start: int) -> Optional[str]:
    """Return substring from start to matching closing bracket, or None."""
    if start < 0 or start >= len(s) or s[start] != open_c:
        return None
    depth = 0
    for i in range(start, len(s)):
        if s[i] == open_c:
            depth += 1
        elif s[i] == close_c:
            depth -= 1
            if depth == 0:
                return s[start : i + 1]
    return None


def _try_parse_equations(json_str: str) -> Optional[List[Dict[str, Any]]]:
    """Parse JSON string and return equations list if valid shape."""
    json_str = _repair_json(json_str)
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError:
        return None
    return _equations_from_data(data)


def _equations_from_data(data: Any) -> Optional[List[Dict[str, Any]]]:
    """Extract equations list from parsed data (dict with equations key or bare list)."""
    if isinstance(data, list):
        return data if data else None
    if not isinstance(data, dict):
        return None
    for key in ("equations", "equation", "eqs"):
        if key in data and isinstance(data[key], list):
            return data[key]
    return None


def _extract_json_from_text(s: str) -> Optional[str]:
    """Find first valid JSON object or array that parses to equations. Tries multiple strategies."""
    s = s.strip()
    if not s:
        return None
    # 1) Full object {"equations": [...]}
    start = s.find("{")
    if start != -1:
        sub = _extract_balanced(s, "{", "}", start)
        if sub and _try_parse_equations(sub):
            return sub
    # 2) Bare array [...]
    start = s.find("[")
    if start != -1:
        sub = _extract_balanced(s, "[", "]", start)
        if sub:
            wrapped = '{"equations": ' + sub + "}"
            if _try_parse_equations(wrapped):
                return wrapped
    # 3) Try repaired full string
    if _try_parse_equations(s):
        return s
    # 4) Scan for any {...} or [...] that parses
    for open_c, close_c in (("{", "}"), ("[", "]")):
        pos = 0
        while True:
            start = s.find(open_c, pos)
            if start == -1:
                break
            sub = _extract_balanced(s, open_c, close_c, start)
            if sub:
                if open_c == "[":
                    sub = '{"equations": ' + sub + "}"
                if _try_parse_equations(sub):
                    return sub
            pos = start + 1
    # 5) Repaired full string (trailing commas etc.)
    repaired = _repair_json(s)
    if repaired != s and _try_parse_equations(repaired):
        return repaired
    # 6) Truncate trailing junk from a balanced array and retry
    start = s.find("[")
    if start != -1:
        sub = _extract_balanced(s, "[", "]", start)
        if sub:
            for truncate in range(1, min(len(sub), 100)):
                candidate = sub[: len(sub) - truncate] + "]"
                wrapped = '{"equations": ' + candidate + "}"
                if _try_parse_equations(wrapped):
                    return wrapped
    return None


def _decode_and_parse(
    tokenizer: ParserTokenizer,
    out_ids: List[int],
    prompt_len: int,
) -> tuple[Optional[str], Optional[List[Dict[str, Any]]]]:
    """Decode generated ids and return (raw_decoded, equations or None)."""
    gen_ids = out_ids[prompt_len:]
    decoded = tokenizer.decode(gen_ids, skip_special=True)
    json_str = _extract_json_from_text(decoded)
    if not json_str:
        return decoded, None
    eqs = _try_parse_equations(json_str)
    return decoded, eqs


def predict_equations(
    model: ParserTransformer,
    tokenizer: ParserTokenizer,
    text: str,
    *,
    device: str = "cpu",
    max_new_tokens: int = 512,
    temperature: float = 0.0,
) -> List[Dict[str, Any]] | None:
    """Run model on text and return parsed equations list or None. Uses greedy by default."""
    prompt = PROMPT_PREFIX + text + OUTPUT_PREFIX
    ids = tokenizer.encode(prompt, add_bos_eos=True)
    idx = torch.tensor([ids], dtype=torch.long, device=device)
    model = model.to(device)
    temp = max(float(temperature), 1e-8)
    out = model.generate(idx, max_new_tokens=max_new_tokens, eos_token_id=tokenizer.eos_id, temperature=temp)
    out_ids = out[0].tolist()
    _, eqs = _decode_and_parse(tokenizer, out_ids, len(ids))
    return eqs


def predict_equations_robust(
    model: ParserTransformer,
    tokenizer: ParserTokenizer,
    text: str,
    *,
    device: str = "cpu",
    max_new_tokens: int = 512,
) -> List[Dict[str, Any]] | None:
    """Multiple attempts with different temperatures and token limits. Returns first valid result."""
    prompt = PROMPT_PREFIX + text + OUTPUT_PREFIX
    ids = tokenizer.encode(prompt, add_bos_eos=True)
    model = model.to(device)
    attempts = [
        {"temperature": 0.0, "max_new_tokens": max_new_tokens},
        {"temperature": 0.0, "max_new_tokens": max(768, max_new_tokens)},
        {"temperature": 0.1, "max_new_tokens": max_new_tokens},
        {"temperature": 0.2, "max_new_tokens": max_new_tokens},
    ]
    for i, kwargs in enumerate(attempts[: _MAX_PREDICT_ATTEMPTS]):
        try:
            idx = torch.tensor([ids], dtype=torch.long, device=device)
            out = model.generate(
                idx,
                max_new_tokens=kwargs["max_new_tokens"],
                eos_token_id=tokenizer.eos_id,
                temperature=max(kwargs["temperature"], 1e-8),
            )
            out_ids = out[0].tolist()
            _, eqs = _decode_and_parse(tokenizer, out_ids, len(ids))
            if eqs:
                return eqs
        except Exception as e:
            logger.debug("parser_predict_attempt attempt={} error={}", i, e)
    return None


def _load_and_predict(model_dir: str | Path, text: str, device: str = "cpu") -> List[Dict[str, Any]] | None:
    try:
        model, tokenizer = load_parser_model(model_dir)
    except Exception as e:
        logger.debug("parser_model_load_failed path={} error={}", model_dir, e)
        return None
    eqs = predict_equations_robust(model, tokenizer, text, device=device)
    return eqs
