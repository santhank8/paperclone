"""Unit tests for VPS MCP client — TRA-23.

All MCP calls are mocked — no real network access.
"""

import json
from unittest.mock import MagicMock, patch

from src.tools.vps_mcp_client import VpsMcpClient


def _make_sse_response(data: dict, session_id: str = "test-session") -> MagicMock:
    """Create a mock urllib response with SSE data."""
    mock_resp = MagicMock()
    mock_resp.read.return_value = f"data: {json.dumps(data)}\n\n".encode()
    mock_resp.headers = MagicMock()
    mock_resp.headers.get = lambda key: session_id if key == "Mcp-Session-Id" else None
    return mock_resp


class TestVpsMcpClientInit:
    def test_defaults_from_env(self) -> None:
        with patch.dict("os.environ", {"VPS_MCP_URL": "https://test.com/mcp", "VPS_MCP_TOKEN": "tok123"}):
            client = VpsMcpClient()
            assert client._url == "https://test.com/mcp"
            assert client._token == "tok123"

    def test_explicit_params(self) -> None:
        client = VpsMcpClient(url="https://custom.com/mcp", token="custom_tok")
        assert client._url == "https://custom.com/mcp"
        assert client._token == "custom_tok"


class TestVpsMcpClientHandshake:
    @patch("urllib.request.urlopen")
    def test_initialize_performs_handshake(self, mock_urlopen: MagicMock) -> None:
        init_resp = _make_sse_response({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {"name": "vps-mcp", "version": "0.1.0"},
                "capabilities": {},
            },
        })
        notif_resp = _make_sse_response({})
        mock_urlopen.side_effect = [init_resp, notif_resp]

        client = VpsMcpClient(url="https://test.com/mcp", token="tok")
        result = client.initialize()

        assert client._initialized is True
        assert client._session_id == "test-session"
        assert mock_urlopen.call_count == 2

    @patch("urllib.request.urlopen")
    def test_double_initialize_is_noop(self, mock_urlopen: MagicMock) -> None:
        init_resp = _make_sse_response({"jsonrpc": "2.0", "id": 1, "result": {"serverInfo": {"name": "x", "version": "0.1"}}})
        notif_resp = _make_sse_response({})
        mock_urlopen.side_effect = [init_resp, notif_resp]

        client = VpsMcpClient(url="https://test.com/mcp", token="tok")
        client.initialize()
        result = client.initialize()

        assert result == {"status": "already_initialized"}
        assert mock_urlopen.call_count == 2  # Only the first init


class TestVpsMcpClientTools:
    @patch("urllib.request.urlopen")
    def test_call_tool_auto_initializes(self, mock_urlopen: MagicMock) -> None:
        init_resp = _make_sse_response({"jsonrpc": "2.0", "id": 1, "result": {"serverInfo": {"name": "x", "version": "0.1"}}})
        notif_resp = _make_sse_response({})
        tool_resp = _make_sse_response({
            "jsonrpc": "2.0",
            "id": 2,
            "result": {
                "content": [{"type": "text", "text": "container1\ncontainer2"}]
            },
        })
        mock_urlopen.side_effect = [init_resp, notif_resp, tool_resp]

        client = VpsMcpClient(url="https://test.com/mcp", token="tok")
        result = client.list_containers()

        assert result["result"]["content"][0]["text"] == "container1\ncontainer2"
        assert mock_urlopen.call_count == 3  # init + notif + tool call

    @patch("urllib.request.urlopen")
    def test_get_container_logs(self, mock_urlopen: MagicMock) -> None:
        init_resp = _make_sse_response({"jsonrpc": "2.0", "id": 1, "result": {"serverInfo": {"name": "x", "version": "0.1"}}})
        notif_resp = _make_sse_response({})
        tool_resp = _make_sse_response({
            "jsonrpc": "2.0",
            "id": 2,
            "result": {
                "content": [{"type": "text", "text": "log line 1\nlog line 2"}]
            },
        })
        mock_urlopen.side_effect = [init_resp, notif_resp, tool_resp]

        client = VpsMcpClient(url="https://test.com/mcp", token="tok")
        result = client.get_container_logs("pnl-service", tail=20)

        assert "log line 1" in result["result"]["content"][0]["text"]

    @patch("urllib.request.urlopen")
    def test_check_service_health(self, mock_urlopen: MagicMock) -> None:
        init_resp = _make_sse_response({"jsonrpc": "2.0", "id": 1, "result": {"serverInfo": {"name": "x", "version": "0.1"}}})
        notif_resp = _make_sse_response({})
        tool_resp = _make_sse_response({
            "jsonrpc": "2.0",
            "id": 2,
            "result": {
                "content": [{"type": "text", "text": "all services healthy"}]
            },
        })
        mock_urlopen.side_effect = [init_resp, notif_resp, tool_resp]

        client = VpsMcpClient(url="https://test.com/mcp", token="tok")
        result = client.check_service_health()

        assert "healthy" in result["result"]["content"][0]["text"]


class TestVpsMcpClientHeaders:
    def test_headers_include_auth(self) -> None:
        client = VpsMcpClient(url="https://test.com/mcp", token="secret123")
        headers = client._headers()
        assert headers["Authorization"] == "Bearer secret123"
        assert "Mcp-Session-Id" not in headers

    def test_headers_include_session_id_after_init(self) -> None:
        client = VpsMcpClient(url="https://test.com/mcp", token="tok")
        client._session_id = "sess-abc"
        headers = client._headers()
        assert headers["Mcp-Session-Id"] == "sess-abc"
