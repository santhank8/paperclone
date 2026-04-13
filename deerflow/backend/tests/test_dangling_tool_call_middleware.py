"""Tests for DanglingToolCallMiddleware.

Covers:
- _message_tool_calls: LangChain-native tool_calls, raw provider additional_kwargs,
  both present (native takes precedence), and empty/missing cases
- _build_patched_messages: no dangling calls (None returned), single dangling call
  patched inline, multiple dangling calls, already-resolved calls skipped
"""

from unittest.mock import MagicMock

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from deerflow.agents.middlewares.dangling_tool_call_middleware import DanglingToolCallMiddleware


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ai_msg(tool_calls=None, additional_kwargs=None):
    """Build an AIMessage with optional native and/or raw provider tool_calls."""
    msg = AIMessage(content="thinking...", tool_calls=tool_calls or [])
    if additional_kwargs:
        # Bypass Pydantic validation by directly setting the attribute
        object.__setattr__(msg, "additional_kwargs", additional_kwargs)
    return msg


def _tool_msg(tool_call_id, name="some_tool"):
    return ToolMessage(content="result", tool_call_id=tool_call_id, name=name)


def _native_tc(name, tc_id, args=None):
    return {"name": name, "args": args or {}, "id": tc_id}


def _raw_provider_tc(name, tc_id, arguments='{"path": "/tmp/a.py"}'):
    """Simulate the additional_kwargs["tool_calls"] format used by some providers."""
    return {"id": tc_id, "function": {"name": name, "arguments": arguments}, "type": "function"}


# ---------------------------------------------------------------------------
# _message_tool_calls
# ---------------------------------------------------------------------------


class TestMessageToolCalls:
    """Unit tests for the static _message_tool_calls helper."""

    def test_native_tool_calls_returned_directly(self):
        """When msg.tool_calls is non-empty, it is returned as-is (may include LangChain 'type' field)."""
        tc = _native_tc("read_file", "call_1", {"path": "/a.py"})
        msg = _ai_msg(tool_calls=[tc])
        result = DanglingToolCallMiddleware._message_tool_calls(msg)
        assert len(result) == 1
        assert result[0]["name"] == "read_file"
        assert result[0]["id"] == "call_1"
        assert result[0]["args"] == {"path": "/a.py"}

    def test_raw_provider_tool_calls_normalized(self):
        """Raw additional_kwargs tool_calls are normalized to LangChain format."""
        raw = _raw_provider_tc("bash", "call_2", '{"command": "echo hi"}')
        msg = _ai_msg(additional_kwargs={"tool_calls": [raw]})
        result = DanglingToolCallMiddleware._message_tool_calls(msg)
        assert len(result) == 1
        assert result[0]["name"] == "bash"
        assert result[0]["id"] == "call_2"
        assert result[0]["args"] == {"command": "echo hi"}

    def test_native_takes_precedence_over_raw(self):
        """If msg.tool_calls is non-empty, additional_kwargs tool_calls are ignored."""
        native_tc = _native_tc("read_file", "call_native")
        raw = _raw_provider_tc("bash", "call_raw")
        msg = _ai_msg(tool_calls=[native_tc], additional_kwargs={"tool_calls": [raw]})
        result = DanglingToolCallMiddleware._message_tool_calls(msg)
        assert len(result) == 1
        assert result[0]["id"] == "call_native"

    def test_empty_when_no_tool_calls(self):
        """Returns [] when neither native nor raw tool calls are present."""
        msg = _ai_msg()
        result = DanglingToolCallMiddleware._message_tool_calls(msg)
        assert result == []

    def test_raw_tool_call_with_invalid_json_args(self):
        """Malformed arguments string falls back to empty dict without raising."""
        raw = _raw_provider_tc("bash", "call_bad", "not valid json {")
        msg = _ai_msg(additional_kwargs={"tool_calls": [raw]})
        result = DanglingToolCallMiddleware._message_tool_calls(msg)
        assert len(result) == 1
        assert result[0]["args"] == {}

    def test_raw_tool_call_skipped_if_no_name_and_no_id(self):
        """Raw tool calls with no name and no id are filtered out."""
        raw = {"function": {"name": "", "arguments": "{}"}, "id": ""}
        msg = _ai_msg(additional_kwargs={"tool_calls": [raw]})
        result = DanglingToolCallMiddleware._message_tool_calls(msg)
        assert result == []

    def test_raw_tool_call_accepted_if_only_id(self):
        """Raw tool call with no name but a valid id is accepted."""
        raw = {"function": {"name": "", "arguments": "{}"}, "id": "call_no_name"}
        msg = _ai_msg(additional_kwargs={"tool_calls": [raw]})
        result = DanglingToolCallMiddleware._message_tool_calls(msg)
        assert len(result) == 1
        assert result[0]["id"] == "call_no_name"
        assert result[0]["name"] == ""

    def test_raw_tool_call_accepted_if_only_name(self):
        """Raw tool call with a name but empty id is accepted."""
        raw = {"function": {"name": "ls", "arguments": "{}"}, "id": ""}
        msg = _ai_msg(additional_kwargs={"tool_calls": [raw]})
        result = DanglingToolCallMiddleware._message_tool_calls(msg)
        assert len(result) == 1
        assert result[0]["name"] == "ls"


# ---------------------------------------------------------------------------
# _build_patched_messages
# ---------------------------------------------------------------------------


class TestBuildPatchedMessages:
    """Tests for the patching logic that inserts placeholder ToolMessages."""

    def _mw(self):
        return DanglingToolCallMiddleware()

    def test_returns_none_when_no_dangling_calls(self):
        """No patching needed — all tool calls already have ToolMessage responses."""
        ai_msg = _ai_msg(tool_calls=[_native_tc("bash", "call_1")])
        tm = _tool_msg("call_1", "bash")
        result = self._mw()._build_patched_messages([ai_msg, tm])
        assert result is None

    def test_returns_none_for_empty_messages(self):
        """Empty message list returns None (nothing to patch)."""
        result = self._mw()._build_patched_messages([])
        assert result is None

    def test_patches_single_dangling_call(self):
        """A dangling tool call gets a placeholder ToolMessage inserted after its AIMessage."""
        ai_msg = _ai_msg(tool_calls=[_native_tc("read_file", "call_dangle", {"path": "/f.py"})])
        result = self._mw()._build_patched_messages([ai_msg])
        assert result is not None
        assert len(result) == 2
        assert result[0] is ai_msg
        tm = result[1]
        assert isinstance(tm, ToolMessage)
        assert tm.tool_call_id == "call_dangle"
        assert tm.name == "read_file"
        assert tm.status == "error"

    def test_patches_inserted_inline_not_at_end(self):
        """Patches are inserted immediately after the dangling AIMessage, not at end."""
        ai_msg_1 = _ai_msg(tool_calls=[_native_tc("bash", "call_first")])
        ai_msg_2 = _ai_msg(tool_calls=[_native_tc("ls", "call_second")])
        result = self._mw()._build_patched_messages([ai_msg_1, ai_msg_2])
        assert result is not None
        # Expected order: ai_msg_1, patch_1, ai_msg_2, patch_2
        assert len(result) == 4
        assert result[0] is ai_msg_1
        assert isinstance(result[1], ToolMessage) and result[1].tool_call_id == "call_first"
        assert result[2] is ai_msg_2
        assert isinstance(result[3], ToolMessage) and result[3].tool_call_id == "call_second"

    def test_already_resolved_calls_not_patched(self):
        """Tool calls that already have ToolMessage responses are not double-patched."""
        ai_msg = _ai_msg(tool_calls=[_native_tc("bash", "call_ok"), _native_tc("ls", "call_dangle")])
        tm = _tool_msg("call_ok", "bash")
        result = self._mw()._build_patched_messages([ai_msg, tm])
        assert result is not None
        # Should contain: ai_msg, existing tm, patch for call_dangle
        tool_msgs = [m for m in result if isinstance(m, ToolMessage)]
        tool_call_ids = {m.tool_call_id for m in tool_msgs}
        assert "call_ok" in tool_call_ids
        assert "call_dangle" in tool_call_ids

    def test_non_ai_messages_preserved_unchanged(self):
        """HumanMessages and ToolMessages in the list pass through unmodified."""
        human = HumanMessage(content="hello")
        ai_msg = _ai_msg(tool_calls=[_native_tc("bash", "call_x")])
        result = self._mw()._build_patched_messages([human, ai_msg])
        assert result is not None
        assert result[0] is human
        assert result[1] is ai_msg

    def test_patches_raw_provider_tool_calls(self):
        """Raw provider additional_kwargs tool calls are detected and patched."""
        raw = _raw_provider_tc("bash", "call_raw_dangle")
        ai_msg = _ai_msg(additional_kwargs={"tool_calls": [raw]})
        result = self._mw()._build_patched_messages([ai_msg])
        assert result is not None
        assert len(result) == 2
        assert isinstance(result[1], ToolMessage)
        assert result[1].tool_call_id == "call_raw_dangle"
        assert result[1].name == "bash"

    def test_no_patch_for_tool_call_without_id(self):
        """Tool calls without an id cannot be matched and are silently skipped."""
        tc_no_id = {"name": "bash", "args": {}, "id": ""}
        ai_msg = _ai_msg(tool_calls=[tc_no_id])
        result = self._mw()._build_patched_messages([ai_msg])
        # No id means no patch can be constructed; returns None
        assert result is None


# ---------------------------------------------------------------------------
# Integration: wrap_model_call / awrap_model_call
# ---------------------------------------------------------------------------


class TestWrapModelCall:
    """Smoke tests verifying the middleware hooks wire up correctly."""

    def _make_request(self, messages):
        req = MagicMock()
        req.messages = messages
        req.override = lambda **kw: MagicMock(messages=kw.get("messages", messages))
        return req

    def test_wrap_model_call_patches_when_needed(self):
        """wrap_model_call inserts patches and forwards to handler."""
        mw = DanglingToolCallMiddleware()
        ai_msg = _ai_msg(tool_calls=[_native_tc("bash", "call_wrap")])
        request = self._make_request([ai_msg])

        captured = {}

        def handler(req):
            captured["messages"] = req.messages
            return MagicMock()

        mw.wrap_model_call(request, handler)

        assert len(captured["messages"]) == 2
        assert isinstance(captured["messages"][1], ToolMessage)

    def test_wrap_model_call_no_op_when_clean(self):
        """wrap_model_call passes the original request unchanged when no patches needed."""
        mw = DanglingToolCallMiddleware()
        ai_msg = _ai_msg(tool_calls=[_native_tc("bash", "call_clean")])
        tm = _tool_msg("call_clean", "bash")
        request = self._make_request([ai_msg, tm])

        captured = {}

        def handler(req):
            captured["request"] = req
            return MagicMock()

        mw.wrap_model_call(request, handler)

        # The handler should receive the original request object unchanged
        assert captured["request"] is request

    def test_awrap_model_call_patches_async(self):
        """awrap_model_call works identically to the sync version."""
        import asyncio

        mw = DanglingToolCallMiddleware()
        ai_msg = _ai_msg(tool_calls=[_native_tc("ls", "call_async")])
        request = self._make_request([ai_msg])

        captured = {}

        async def handler(req):
            captured["messages"] = req.messages
            return MagicMock()

        async def run():
            await mw.awrap_model_call(request, handler)

        asyncio.run(run())

        assert len(captured["messages"]) == 2
        assert isinstance(captured["messages"][1], ToolMessage)
