"""Tests for TRA-27: Document Registry full enforcement (persona-scoped filtering).

Validates that persona-scoped document access is enforced — agents cannot
fetch documents outside their persona's allowed list.
"""

import pytest

from src.config_loader import (
    ensure_document_path_allowed,
    get_documents_for_persona,
)

SAMPLE_REGISTRY = {
    "documents": [
        {"path": "PRODUCT_ROADMAP.md", "readers": ["po", "scrum_master"]},
        {"path": "docs/specs/FUNCTIONAL_SPECIFICATION.md", "readers": ["po", "architect", "code_operator", "test_lead"]},
        {"path": "docs/specs/ARCHITECTURE.md", "readers": ["po", "architect", "code_operator", "test_lead", "infra_lead"]},
        {"path": "docs/specs/FRONTEND_DESIGN.md", "readers": ["code_operator", "test_lead"]},
        {"path": "docs/OPERATIONS.md", "readers": ["infra_lead"]},
        {"path": "docs/LESSONS_LEARNED.md", "readers": ["architect", "code_operator", "test_lead", "infra_lead"]},
        {"path": "docs/AGENT_MEMORY.md", "readers": ["scrum_master", "code_operator"]},
    ],
    "excluded": ["docs/archive/*"],
}


class TestPersonaFiltering:
    def test_po_gets_roadmap_and_specs(self) -> None:
        docs = get_documents_for_persona(SAMPLE_REGISTRY, "po")
        paths = {d["path"] for d in docs}
        assert "PRODUCT_ROADMAP.md" in paths
        assert "docs/specs/FUNCTIONAL_SPECIFICATION.md" in paths
        assert "docs/specs/ARCHITECTURE.md" in paths
        # PO should NOT get operations or frontend docs
        assert "docs/OPERATIONS.md" not in paths
        assert "docs/specs/FRONTEND_DESIGN.md" not in paths

    def test_infra_lead_gets_ops_and_arch(self) -> None:
        docs = get_documents_for_persona(SAMPLE_REGISTRY, "infra_lead")
        paths = {d["path"] for d in docs}
        assert "docs/OPERATIONS.md" in paths
        assert "docs/specs/ARCHITECTURE.md" in paths
        # Infra lead should NOT get roadmap
        assert "PRODUCT_ROADMAP.md" not in paths

    def test_code_operator_cannot_access_operations(self) -> None:
        docs = get_documents_for_persona(SAMPLE_REGISTRY, "code_operator")
        paths = {d["path"] for d in docs}
        assert "docs/OPERATIONS.md" not in paths

    def test_scrum_master_gets_roadmap_and_memory(self) -> None:
        docs = get_documents_for_persona(SAMPLE_REGISTRY, "scrum_master")
        paths = {d["path"] for d in docs}
        assert "PRODUCT_ROADMAP.md" in paths
        assert "docs/AGENT_MEMORY.md" in paths


class TestPersonaEnforcement:
    """Test that ensure_document_path_allowed rejects unauthorized access."""

    def test_po_can_access_roadmap(self) -> None:
        # Should not raise
        ensure_document_path_allowed(
            "PRODUCT_ROADMAP.md", registry=SAMPLE_REGISTRY, persona="po"
        )

    def test_po_cannot_access_operations(self) -> None:
        with pytest.raises(ValueError, match="not allowed for persona 'po'"):
            ensure_document_path_allowed(
                "docs/OPERATIONS.md", registry=SAMPLE_REGISTRY, persona="po"
            )

    def test_infra_lead_cannot_access_roadmap(self) -> None:
        with pytest.raises(ValueError, match="not allowed for persona 'infra_lead'"):
            ensure_document_path_allowed(
                "PRODUCT_ROADMAP.md", registry=SAMPLE_REGISTRY, persona="infra_lead"
            )

    def test_code_operator_can_access_functional_spec(self) -> None:
        ensure_document_path_allowed(
            "docs/specs/FUNCTIONAL_SPECIFICATION.md",
            registry=SAMPLE_REGISTRY,
            persona="code_operator",
        )

    def test_code_operator_cannot_access_operations(self) -> None:
        with pytest.raises(ValueError, match="not allowed for persona"):
            ensure_document_path_allowed(
                "docs/OPERATIONS.md",
                registry=SAMPLE_REGISTRY,
                persona="code_operator",
            )

    def test_exclusion_still_enforced_with_persona(self) -> None:
        """Even if a persona is provided, excluded paths are still blocked."""
        with pytest.raises(ValueError, match="excluded"):
            ensure_document_path_allowed(
                "docs/archive/old-spec.md",
                registry=SAMPLE_REGISTRY,
                persona="po",
            )

    def test_no_persona_allows_any_non_excluded(self) -> None:
        """Without persona, only exclusion check applies (backward compatible)."""
        ensure_document_path_allowed(
            "docs/OPERATIONS.md", registry=SAMPLE_REGISTRY, persona=None
        )

    def test_normalized_path_matching(self) -> None:
        """Paths with leading ./ should be normalized."""
        ensure_document_path_allowed(
            "./PRODUCT_ROADMAP.md", registry=SAMPLE_REGISTRY, persona="po"
        )
