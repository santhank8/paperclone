"""VPS MCP client — thin wrapper for the 3-step MCP handshake.

Follows the exact Python urllib-based pattern documented in CLAUDE.md §9.
Provides read-only access to Docker containers, NATS, PostgreSQL, system
health, and log files on the Contabo VPS.

Spec ref: ACTION_SPEC_WF2 §C — VPS MCP verification tooling
"""

from __future__ import annotations

import json
import logging
import os
import ssl
import urllib.request
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Defaults from CLAUDE.md §9
DEFAULT_MCP_URL = "https://mcp.kaizai.co/mcp"


class VpsMcpClient:
    """Stateful MCP client using the 3-step Streamable HTTP handshake."""

    def __init__(
        self,
        url: Optional[str] = None,
        token: Optional[str] = None,
    ) -> None:
        self._url = url or os.environ.get("VPS_MCP_URL", DEFAULT_MCP_URL)
        self._token = token or os.environ.get("VPS_MCP_TOKEN", "")
        self._ssl_ctx = ssl.create_default_context()
        self._session_id: Optional[str] = None
        self._initialized = False
        self._msg_counter = 0

    def _next_id(self) -> int:
        self._msg_counter += 1
        return self._msg_counter

    def _headers(self) -> dict[str, str]:
        h: dict[str, str] = {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if self._session_id:
            h["Mcp-Session-Id"] = self._session_id
        return h

    def _post(
        self,
        method: str,
        params: Optional[dict] = None,
        msg_id: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
        """Send a JSON-RPC request and parse the SSE response."""
        body: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params:
            body["params"] = params
        if msg_id is not None:
            body["id"] = msg_id

        req = urllib.request.Request(
            self._url,
            method="POST",
            headers=self._headers(),
            data=json.dumps(body).encode(),
        )
        resp = urllib.request.urlopen(req, timeout=30, context=self._ssl_ctx)

        # Capture session ID from response headers
        sid = resp.headers.get("Mcp-Session-Id")
        if sid:
            self._session_id = sid

        raw = resp.read().decode()
        for line in raw.split("\n"):
            if line.startswith("data: "):
                return json.loads(line[6:])
        return None

    def initialize(self) -> dict[str, Any]:
        """Execute the 3-step MCP handshake.

        1. initialize → capture Mcp-Session-Id
        2. notifications/initialized
        3. Ready for tools/call
        """
        if self._initialized:
            return {"status": "already_initialized"}

        # Step 1: Initialize
        result = self._post(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "infra-lead", "version": "1.0"},
            },
            msg_id=self._next_id(),
        )

        # Step 2: Send initialized notification
        self._post("notifications/initialized", {})

        self._initialized = True
        return result or {}

    def call_tool(
        self, name: str, arguments: Optional[dict] = None
    ) -> dict[str, Any]:
        """Call an MCP tool by name. Auto-initializes if needed."""
        if not self._initialized:
            self.initialize()

        result = self._post(
            "tools/call",
            {"name": name, "arguments": arguments or {}},
            msg_id=self._next_id(),
        )
        return result or {}

    # ── Convenience wrappers for Infra Lead ──

    def list_containers(self) -> dict[str, Any]:
        """List all Docker containers on the VPS."""
        return self.call_tool("list_containers")

    def get_container_logs(
        self, container: str, tail: int = 50
    ) -> dict[str, Any]:
        """Get recent logs from a container."""
        return self.call_tool(
            "get_container_logs",
            {"container": container, "tail": tail},
        )

    def get_container_stats(self, container: str) -> dict[str, Any]:
        """Get resource usage stats for a container."""
        return self.call_tool(
            "get_container_stats", {"container": container}
        )

    def check_service_health(self) -> dict[str, Any]:
        """Check overall service health on the VPS."""
        return self.call_tool("check_service_health")
