"""
DuckDuckGo Web Search Tool — no API key required.
Uses the ddgs library (already a DeerFlow dependency).
"""

import json
import logging

from langchain.tools import tool

from src.config import get_app_config

logger = logging.getLogger(__name__)


@tool("web_search", parse_docstring=True)
def web_search_tool(query: str) -> str:
    """Search the web using DuckDuckGo.

    Args:
        query: The query to search for.
    """
    try:
        from ddgs import DDGS
    except ImportError:
        return json.dumps({"error": "ddgs library not installed. Run: uv add ddgs"})

    config = get_app_config().get_tool_config("web_search")
    max_results = 5
    if config is not None and "max_results" in config.model_extra:
        max_results = config.model_extra.get("max_results", max_results)

    try:
        ddgs = DDGS(timeout=30)
        results = ddgs.text(query, max_results=max_results)
        normalized = [
            {
                "title": r.get("title", ""),
                "url": r.get("href", ""),
                "snippet": r.get("body", ""),
            }
            for r in results
        ]
        return json.dumps(normalized, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"DuckDuckGo search failed: {e}")
        return json.dumps({"error": str(e)})
