"""Risk and workflow-scope classification utilities for WF1 routing."""

from __future__ import annotations

from fnmatch import fnmatch
from typing import Literal

RiskTier = Literal["normal", "high_risk", "protected"]

HIGH_RISK_PATTERNS = [
    "services/*/auth*",
    "services/*/tenant*",
    "services/*/migrations/*",
]

PROTECTED_PATTERNS = [
    ".github/workflows/**",
    "infra/**",
    "contracts/**",
    "CLAUDE.md",
    "DOCUMENT_REGISTRY.yaml",
    "docs/specs/*",
]


def _matches_any(path: str, patterns: list[str]) -> bool:
    """Return True when the file path matches at least one glob pattern."""
    normalized = path.lstrip("./")
    return any(fnmatch(normalized, pattern) for pattern in patterns)


def classify_pr_risk(changed_files: list[str]) -> RiskTier:
    """Classify PR risk tier from changed-file paths."""
    for path in changed_files:
        if _matches_any(path, PROTECTED_PATTERNS):
            return "protected"
    for path in changed_files:
        if _matches_any(path, HIGH_RISK_PATTERNS):
            return "high_risk"
    return "normal"


def select_test_workflows(changed_files: list[str]) -> list[str]:
    """Select GitHub test workflows based on changed-file scope.

    Rules:
    - workforce-only changes => test-workforce.yml
    - platform-only changes => run-tests.yml
    - mixed changes => both
    """
    has_workforce = any(path.startswith("agent-workforce/") for path in changed_files)
    has_platform = any(
        not path.startswith("agent-workforce/") for path in changed_files
    )

    workflows: list[str] = []
    if has_platform:
        workflows.append("run-tests.yml")
    if has_workforce:
        workflows.append("test-workforce.yml")
    if not workflows:
        workflows.append("run-tests.yml")
    return workflows
