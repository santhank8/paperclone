"""crca_llm: non-authoritative LLM coauthor layer.

This package is intentionally optional and must never emit numeric causal
outputs on its own. It drafts specs and checklists only.
"""

from crca_llm.coauthor import CoauthorConfig, DraftBundle, LLMCoauthor
from crca_llm.equation_extractor import extract_structural_equations_llm
from crca_llm.orchestrator import LLMOrchestrator
from crca_llm.types import LLMRunResult

__all__ = [
    "CoauthorConfig",
    "DraftBundle",
    "LLMCoauthor",
    "LLMOrchestrator",
    "LLMRunResult",
    "extract_structural_equations_llm",
]

