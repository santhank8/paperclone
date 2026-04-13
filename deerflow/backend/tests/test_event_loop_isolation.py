"""Tests for event loop isolation in subagent executor.

Uses importlib.util to load executor.py directly, stubbing heavy deps
to avoid the circular-import chain (same approach as test_subagent_cancellation).
"""

import asyncio
import concurrent.futures
import importlib.util
import sys
from pathlib import Path
import types
from unittest.mock import MagicMock

import pytest


def _load_executor_directly():
    """Load executor.py as a standalone module, stubbing heavy deps."""
    stubs = {}

    la = types.ModuleType("langchain.agents")
    la.create_agent = MagicMock()
    stubs["langchain"] = types.ModuleType("langchain")
    stubs["langchain.agents"] = la

    lt = types.ModuleType("langchain.tools")
    lt.BaseTool = MagicMock
    stubs["langchain.tools"] = lt

    lc = types.ModuleType("langchain_core")
    lcm = types.ModuleType("langchain_core.messages")
    lcm.AIMessage = MagicMock
    lcm.HumanMessage = MagicMock
    lcr = types.ModuleType("langchain_core.runnables")
    lcr.RunnableConfig = dict
    stubs["langchain_core"] = lc
    stubs["langchain_core.messages"] = lcm
    stubs["langchain_core.runnables"] = lcr

    ts = types.ModuleType("deerflow.agents.thread_state")
    ts.SandboxState = MagicMock
    ts.ThreadDataState = MagicMock
    ts.ThreadState = MagicMock
    stubs["deerflow.agents"] = types.ModuleType("deerflow.agents")
    stubs["deerflow.agents.thread_state"] = ts

    dm = types.ModuleType("deerflow.models")
    dm.create_chat_model = MagicMock()
    stubs["deerflow.models"] = dm

    dsc = types.ModuleType("deerflow.subagents.config")
    dsc.SubagentConfig = MagicMock
    stubs["deerflow.subagents"] = types.ModuleType("deerflow.subagents")
    stubs["deerflow.subagents.config"] = dsc

    saved = {}
    for key, mod in stubs.items():
        saved[key] = sys.modules.get(key)
        sys.modules[key] = mod

    executor_key = "deerflow.subagents.executor"
    saved[executor_key] = sys.modules.pop(executor_key, None)

    try:
        spec = importlib.util.spec_from_file_location(
            executor_key,
            str(Path(__file__).resolve().parent.parent / "deerflow" / "subagents" / "executor.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    finally:
        for key, orig in saved.items():
            if orig is None:
                sys.modules.pop(key, None)
            else:
                sys.modules[key] = orig


_real = _load_executor_directly()
_execute_in_isolated_loop = _real._execute_in_isolated_loop


class TestIsolatedLoop:
    def test_runs_coroutine_successfully(self):
        async def simple_coro():
            return 42
        result = _execute_in_isolated_loop(simple_coro())
        assert result == 42

    def test_works_from_thread_with_no_loop(self):
        async def coro():
            return "from thread"
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(_execute_in_isolated_loop, coro())
            assert future.result() == "from thread"

    def test_propagates_exceptions(self):
        async def failing_coro():
            raise ValueError("test error")
        with pytest.raises(ValueError, match="test error"):
            _execute_in_isolated_loop(failing_coro())

    def test_multiple_calls_same_thread(self):
        """Multiple calls from same thread should reuse the same loop."""
        async def coro1():
            return 1
        async def coro2():
            return 2
        assert _execute_in_isolated_loop(coro1()) == 1
        assert _execute_in_isolated_loop(coro2()) == 2
