"""Tests for LLM-based structural equation extractor."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import pytest

from crca_llm.client import OpenAIClient
from crca_llm.equation_extractor import extract_structural_equations_llm


class _MockClient:
    """Client that returns a fixed JSON response without calling the API."""

    def __init__(self, response_json: Dict[str, Any]) -> None:
        import json
        self._content = json.dumps(response_json)

    def _require_key(self) -> None:
        pass

    def chat_completion(self, **kwargs: Any) -> str:
        return self._content


def test_extract_returns_equations_when_llm_returns_valid_json() -> None:
    payload = {
        "equations": [
            {"variable": "X", "parents": [], "coefficients": {}, "intercept": 0.0},
            {"variable": "Y", "parents": ["X"], "coefficients": {"X": 2.0}, "intercept": 0.0},
        ],
    }
    client = _MockClient(payload)
    result = extract_structural_equations_llm("X = U_X; Y = 2*X + U_Y", client=client, model="test")
    assert result is not None
    assert len(result) == 2
    assert result[0]["variable"] == "X"
    assert result[0]["parents"] == []
    assert result[1]["variable"] == "Y"
    assert result[1]["coefficients"] == {"X": 2.0}


def test_extract_returns_none_when_llm_returns_invalid_json() -> None:
    client = _MockClient({"equations": "not a list"})
    result = extract_structural_equations_llm("some text", client=client, model="test")
    assert result is None


def test_extract_returns_none_when_equations_missing() -> None:
    client = _MockClient({})
    result = extract_structural_equations_llm("some text", client=client, model="test")
    assert result is None


def test_extract_returns_none_when_duplicate_variable() -> None:
    payload = {
        "equations": [
            {"variable": "X", "parents": [], "coefficients": {}, "intercept": 0.0},
            {"variable": "X", "parents": ["Y"], "coefficients": {"Y": 1.0}, "intercept": 0.0},
        ],
    }
    client = _MockClient(payload)
    result = extract_structural_equations_llm("text", client=client, model="test")
    assert result is None


def test_extract_normalizes_coefficients_to_float() -> None:
    payload = {
        "equations": [
            {"variable": "Y", "parents": ["X"], "coefficients": {"X": 2}, "intercept": 0},
        ],
    }
    client = _MockClient(payload)
    result = extract_structural_equations_llm("Y = 2*X + U_Y", client=client, model="test")
    assert result is not None
    assert result[0]["coefficients"]["X"] == 2.0
    assert result[0]["intercept"] == 0.0
