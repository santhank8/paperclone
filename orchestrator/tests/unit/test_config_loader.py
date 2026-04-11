"""Tests for configuration loading.

Spec ref: AgenticSquad_Functional_Spec v2.8 RC §3.3, §5
"""

import pytest

from src.config_loader import (
    ensure_document_path_allowed,
    load_project_config,
    load_document_registry,
    get_documents_for_persona,
    is_path_excluded,
)


class TestLoadProjectConfig:
    def test_loads_valid_config(self, tmp_path) -> None:
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
project:
  name: test-project
  repo: owner/repo
cost_control:
  monthly_budget_usd: 50.0
"""
        )
        config = load_project_config(str(config_file))
        assert config["project"]["name"] == "test-project"
        assert config["cost_control"]["monthly_budget_usd"] == 50.0

    def test_raises_on_missing_file(self, tmp_path) -> None:
        with pytest.raises(FileNotFoundError):
            load_project_config(str(tmp_path / "nonexistent.yaml"))

    def test_raises_on_missing_project_key(self, tmp_path) -> None:
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
cost_control:
  monthly_budget_usd: 50.0
"""
        )
        with pytest.raises(ValueError, match="project"):
            load_project_config(str(config_file))

    def test_raises_on_missing_cost_control_key(self, tmp_path) -> None:
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
project:
  name: test
  repo: owner/repo
"""
        )
        with pytest.raises(ValueError, match="cost_control"):
            load_project_config(str(config_file))

    def test_raises_on_missing_project_name(self, tmp_path) -> None:
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
project:
  repo: owner/repo
cost_control:
  monthly_budget_usd: 50.0
"""
        )
        with pytest.raises(ValueError, match="name"):
            load_project_config(str(config_file))


class TestLoadDocumentRegistry:
    def test_loads_valid_registry(self, tmp_path) -> None:
        reg_file = tmp_path / "registry.yaml"
        reg_file.write_text(
            """
documents:
  - path: "docs/spec.md"
    purpose: "The spec"
    readers: [po, architect]
  - path: "docs/ops.md"
    purpose: "Operations"
    readers: [infra_lead]
excluded:
  - "docs/archive/*"
"""
        )
        registry = load_document_registry(str(reg_file))
        assert len(registry["documents"]) == 2

    def test_raises_on_missing_file(self, tmp_path) -> None:
        with pytest.raises(FileNotFoundError):
            load_document_registry(str(tmp_path / "missing.yaml"))


class TestGetDocumentsForPersona:
    def test_filter_documents_by_persona(self) -> None:
        registry = {
            "documents": [
                {"path": "a.md", "readers": ["po", "architect"]},
                {"path": "b.md", "readers": ["infra_lead"]},
            ]
        }
        po_docs = get_documents_for_persona(registry, "po")
        assert len(po_docs) == 1
        assert po_docs[0]["path"] == "a.md"

    def test_returns_empty_for_unknown_persona(self) -> None:
        registry = {
            "documents": [
                {"path": "a.md", "readers": ["po"]},
            ]
        }
        result = get_documents_for_persona(registry, "nonexistent")
        assert result == []

    def test_returns_all_matching_docs(self) -> None:
        registry = {
            "documents": [
                {"path": "a.md", "readers": ["architect"]},
                {"path": "b.md", "readers": ["architect", "po"]},
                {"path": "c.md", "readers": ["infra_lead"]},
            ]
        }
        result = get_documents_for_persona(registry, "architect")
        assert len(result) == 2

    def test_handles_empty_registry(self) -> None:
        registry = {"documents": []}
        result = get_documents_for_persona(registry, "po")
        assert result == []


class TestDocumentRegistryExclusions:
    def test_matches_excluded_glob_pattern(self) -> None:
        assert is_path_excluded(
            "docs/archive/old-spec.md", ["docs/archive/*"]
        )

    def test_does_not_match_allowed_path(self) -> None:
        assert not is_path_excluded(
            "docs/specs/ARCHITECTURE.md", ["docs/archive/*"]
        )

    def test_raises_for_excluded_path(self) -> None:
        registry = {"excluded": ["docs/archive/*"]}

        with pytest.raises(ValueError, match="excluded by DOCUMENT_REGISTRY"):
            ensure_document_path_allowed("docs/archive/old-spec.md", registry)

    def test_allows_non_excluded_path(self) -> None:
        registry = {"excluded": ["docs/archive/*"]}

        ensure_document_path_allowed("docs/specs/ARCHITECTURE.md", registry)
