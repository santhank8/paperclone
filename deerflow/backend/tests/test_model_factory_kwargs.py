"""Test that model factory handles overlapping kwargs without TypeError."""

from unittest.mock import MagicMock, patch

import pytest


def test_duplicate_kwargs_no_typeerror():
    """If kwargs and model_settings_from_config share a key, no TypeError should occur."""
    from deerflow.models.factory import create_chat_model

    mock_model_config = MagicMock()
    mock_model_config.name = "test"
    mock_model_config.use = "langchain_openai.ChatOpenAI"
    mock_model_config.supports_thinking = False
    mock_model_config.supports_reasoning_effort = False
    mock_model_config.when_thinking_enabled = None
    mock_model_config.when_thinking_disabled = None
    mock_model_config.thinking = None
    mock_model_config.supports_vision = False
    mock_model_config.model_dump.return_value = {"temperature": 0.5}

    mock_app_config = MagicMock()
    mock_app_config.models = [mock_model_config]
    mock_app_config.get_model_config.return_value = mock_model_config

    mock_class = MagicMock()

    with (
        patch("deerflow.models.factory.get_app_config", return_value=mock_app_config),
        patch("deerflow.models.factory.resolve_class", return_value=mock_class),
        patch("deerflow.models.factory.is_tracing_enabled", return_value=False),
    ):
        # Pass temperature in kwargs too — should not raise TypeError
        create_chat_model(name="test", temperature=0.7)

    # kwargs should win over config
    call_kwargs = mock_class.call_args[1]
    assert call_kwargs["temperature"] == 0.7
