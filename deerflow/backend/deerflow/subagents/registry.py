"""Subagent registry for managing available subagents."""

import logging
from dataclasses import replace

from deerflow.subagents.builtins import BUILTIN_SUBAGENTS
from deerflow.subagents.config import SubagentConfig

logger = logging.getLogger(__name__)


def get_subagent_config(name: str) -> SubagentConfig | None:
    """Get a subagent configuration by name, with config.yaml overrides applied.

    Args:
        name: The name of the subagent.

    Returns:
        SubagentConfig if found (with any config.yaml overrides applied), None otherwise.
    """
    config = BUILTIN_SUBAGENTS.get(name)
    if config is None:
        return None

    # Apply overrides from config.yaml (lazy import to avoid circular deps)
    from deerflow.config.subagents_config import get_subagents_app_config

    app_config = get_subagents_app_config()
    overrides: dict = {}

    # Timeout override
    effective_timeout = app_config.get_timeout_for(name)
    if effective_timeout != config.timeout_seconds:
        logger.debug(f"Subagent '{name}': timeout overridden ({config.timeout_seconds}s -> {effective_timeout}s)")
        overrides["timeout_seconds"] = effective_timeout

    # Model override
    effective_model = app_config.get_model_for(name)
    if effective_model is not None and effective_model != config.model:
        logger.debug(f"Subagent '{name}': model overridden ('{config.model}' -> '{effective_model}')")
        overrides["model"] = effective_model

    if overrides:
        config = replace(config, **overrides)

    return config


def list_subagents() -> list[SubagentConfig]:
    """List all available subagent configurations (with config.yaml overrides applied).

    Returns:
        List of all registered SubagentConfig instances.
    """
    return [get_subagent_config(name) for name in BUILTIN_SUBAGENTS]


def get_subagent_names() -> list[str]:
    """Get all available subagent names.

    Returns:
        List of subagent names.
    """
    return list(BUILTIN_SUBAGENTS.keys())
