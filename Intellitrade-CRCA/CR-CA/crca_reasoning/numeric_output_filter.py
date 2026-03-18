"""Deterministic policy filter for numeric outputs.

Policy:
- Never block: allow all replies; warn only for unsourced numeric claims
  (strict causal or otherwise) so the agent always complies with the user.
"""

from __future__ import annotations

import re
from typing import Optional, Tuple


_COUNTERFACTUAL_PHRASES = (
    "counterfactual",
    "would have been",
    "what-if",
    "what if",
    "do(",
    "under the intervention",
)
_EFFECT_PHRASES = (
    "causal effect",
    "average treatment effect",
    "ate",
    "effect estimate",
)
_TOOL_CITE_PATTERNS = (
    "from the counterfactual tool",
    "from the estimate tool",
    "counterfactual tool returned",
    "estimate tool returned",
    "structural_equations_used",
    "factual_vs_counterfactual",
    "abduced_u",
    "result_type",
    "predict_artifact",
    "p_event",
    "nested_mc_p_event",
    "nested_mc_predict_artifact",
    "PredictArtifactResult",
    "PEventResult",
    "from the predict_artifact tool",
    "from the p_event tool",
    "from the nested_mc",
)
_NUMBER_PATTERN = re.compile(r"[-+]?\d*\.?\d+(?:e[-+]?\d+)?", re.IGNORECASE)


def _has_number(text: str) -> bool:
    return _NUMBER_PATTERN.search(text) is not None


def _looks_causal_numeric_claim(text: str) -> bool:
    lower = text.lower()
    if any(p in lower for p in _COUNTERFACTUAL_PHRASES):
        return True
    return any(p in lower for p in _EFFECT_PHRASES)


def _looks_tool_cited(text: str) -> bool:
    lower = text.lower()
    return any(p in lower for p in _TOOL_CITE_PATTERNS)


def apply_numeric_output_policy(
    reply: str,
    *,
    strict_causal_intent: bool = False,
    tool_evidence: bool = False,
) -> Tuple[bool, str, Optional[str]]:
    """Apply deterministic numeric-source policy.

    Returns:
        (allowed, transformed_reply, policy_reason)
    """
    if not reply or not reply.strip():
        return True, reply, None

    has_number = _has_number(reply)
    if not has_number:
        return True, reply, None

    cited = tool_evidence or _looks_tool_cited(reply)
    causal_numeric = strict_causal_intent or _looks_causal_numeric_claim(reply)

    # Policy: never block; allow user-facing reply and warn if unsourced (was: hard refusal for causal_numeric).
    if causal_numeric and not cited:
        warning = (
            "\n\n[Warning: numeric statements are not tool-sourced. For causal numbers, use locked-spec tools.]"
        )
        return True, reply.rstrip() + warning, "unsourced_causal_numeric_claim"

    if not causal_numeric and not cited:
        warning = (
            "\n\n[Warning: numeric statements are not tool-sourced. For causal numbers, use locked-spec tools.]"
        )
        return True, reply.rstrip() + warning, "unsourced_numeric_warning"

    return True, reply, None


def ensure_tool_sourced_numeric_disclaimer(reply: str) -> str:
    """Backward-compatible wrapper (warn-only mode)."""
    allowed, transformed, _reason = apply_numeric_output_policy(
        reply,
        strict_causal_intent=False,
        tool_evidence=False,
    )
    if not allowed:
        # Legacy behavior expected a string response, so return a warning-shaped message.
        return transformed
    return transformed
