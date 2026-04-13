"""Tests for file operation lock integration in sandbox tools."""

import inspect

from deerflow.sandbox.file_operation_lock import get_file_lock


class TestGetFileLock:
    def test_same_path_returns_same_lock(self):
        lock1 = get_file_lock("sandbox1", "/mnt/user-data/workspace/foo.py")
        lock2 = get_file_lock("sandbox1", "/mnt/user-data/workspace/foo.py")
        assert lock1 is lock2

    def test_different_paths_return_different_locks(self):
        lock1 = get_file_lock("sandbox1", "/mnt/user-data/workspace/foo.py")
        lock2 = get_file_lock("sandbox1", "/mnt/user-data/workspace/bar.py")
        assert lock1 is not lock2

    def test_different_sandboxes_return_different_locks(self):
        lock1 = get_file_lock("sandbox1", "/mnt/user-data/workspace/foo.py")
        lock2 = get_file_lock("sandbox2", "/mnt/user-data/workspace/foo.py")
        assert lock1 is not lock2


class TestToolsUseLocks:
    """Verify that sandbox tools acquire file locks."""

    def test_str_replace_uses_lock(self):
        import deerflow.sandbox.tools as tools_module
        # @tool decorator wraps the function into a StructuredTool;
        # access the underlying callable via .func
        source = inspect.getsource(tools_module.str_replace_tool.func)
        assert "get_file_lock" in source, "str_replace_tool should use get_file_lock"

    def test_write_file_uses_lock(self):
        import deerflow.sandbox.tools as tools_module
        source = inspect.getsource(tools_module.write_file_tool.func)
        assert "get_file_lock" in source, "write_file_tool should use get_file_lock"
