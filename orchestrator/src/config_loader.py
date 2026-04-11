"""Configuration loader — loads project config and document registry.

Spec ref: AgenticSquad_Functional_Spec v2.8 RC §3.3, §5
"""

from __future__ import annotations

from fnmatch import fnmatch
import logging
from pathlib import Path, PurePosixPath
from typing import Any

import yaml

logger = logging.getLogger(__name__)
DEFAULT_DOCUMENT_REGISTRY_PATH = (
    Path(__file__).resolve().parents[2] / "DOCUMENT_REGISTRY.yaml"
)


def load_project_config(path: str) -> dict[str, Any]:
    """Load and validate the project configuration YAML.

    Args:
        path: Path to the project config file (e.g., config/trading-agent.yaml).

    Returns:
        Parsed configuration dictionary.

    Raises:
        FileNotFoundError: If the config file does not exist.
        ValueError: If required fields are missing.
    """
    config_path = Path(path)
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with open(config_path) as f:
        config: dict[str, Any] = yaml.safe_load(f)

    # Validate required top-level keys
    required_keys = ["project", "cost_control"]
    for key in required_keys:
        if key not in config:
            raise ValueError(f"Missing required config key: {key}")

    # Validate project section
    project = config["project"]
    if "name" not in project or "repo" not in project:
        raise ValueError("project config must have 'name' and 'repo'")

    logger.info(
        f"Loaded project config: {project['name']} ({project['repo']})"
    )
    return config


def load_document_registry(path: str) -> dict[str, Any]:
    """Load the document registry YAML.

    Args:
        path: Path to DOCUMENT_REGISTRY.yaml.

    Returns:
        Parsed registry dictionary with 'documents' and optional 'excluded'.

    Raises:
        FileNotFoundError: If the registry file does not exist.
    """
    reg_path = Path(path)
    if not reg_path.exists():
        raise FileNotFoundError(f"Document registry not found: {path}")

    with open(reg_path) as f:
        registry: dict[str, Any] = yaml.safe_load(f)

    doc_count = len(registry.get("documents", []))
    logger.info(f"Loaded document registry: {doc_count} documents")
    return registry


def is_path_excluded(path: str, excluded_patterns: list[str]) -> bool:
    """Return True when a path matches an excluded registry pattern."""
    normalized_path = PurePosixPath(path).as_posix().lstrip("./")
    return any(fnmatch(normalized_path, pattern) for pattern in excluded_patterns)


def ensure_document_path_allowed(
    path: str,
    registry: dict[str, Any] | None = None,
    persona: str | None = None,
) -> None:
    """Raise when a document path is excluded or not allowed for a persona.

    Validates two layers:
    1. Exclusion check: path must not match any excluded pattern.
    2. Persona check (if persona provided): path must be in the persona's
       allowed document list.
    """
    active_registry = registry or load_document_registry(
        str(DEFAULT_DOCUMENT_REGISTRY_PATH)
    )
    excluded_patterns = active_registry.get("excluded", [])
    if is_path_excluded(path, excluded_patterns):
        raise ValueError(
            f"Document path '{path}' is excluded by DOCUMENT_REGISTRY and "
            "cannot be fetched."
        )

    if persona is not None:
        allowed_docs = get_documents_for_persona(active_registry, persona)
        allowed_paths = {doc["path"] for doc in allowed_docs}
        normalized = PurePosixPath(path).as_posix().lstrip("./")
        if normalized not in allowed_paths:
            raise ValueError(
                f"Document path '{path}' is not allowed for persona '{persona}'. "
                f"Allowed: {sorted(allowed_paths)}"
            )


def get_documents_for_persona(
    registry: dict[str, Any], persona: str
) -> list[dict[str, Any]]:
    """Filter documents from the registry by persona.

    Args:
        registry: Parsed document registry.
        persona: The persona name (e.g., 'po', 'architect', 'infra_lead').

    Returns:
        List of document entries where the persona is in the readers list.
    """
    documents = registry.get("documents", [])
    return [
        doc for doc in documents if persona in doc.get("readers", [])
    ]
