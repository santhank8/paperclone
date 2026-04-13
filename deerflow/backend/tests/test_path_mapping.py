"""Tests for PathMapping dataclass."""

import pytest

from deerflow.sandbox.path_mapping import PathMapping, resolve_path, check_writable


class TestPathMapping:
    def test_basic_creation(self):
        pm = PathMapping(container_path="/mnt/user-data", local_path="/tmp/data")
        assert pm.container_path == "/mnt/user-data"
        assert pm.local_path == "/tmp/data"
        assert pm.read_only is False

    def test_read_only_flag(self):
        pm = PathMapping(container_path="/mnt/skills", local_path="/tmp/skills", read_only=True)
        assert pm.read_only is True

    def test_frozen(self):
        pm = PathMapping(container_path="/mnt/a", local_path="/tmp/a")
        with pytest.raises(AttributeError):
            pm.local_path = "/other"

    def test_resolve_exact_match(self):
        pm = PathMapping(container_path="/mnt/user-data", local_path="/tmp/data")
        assert pm.resolve("/mnt/user-data") == "/tmp/data"

    def test_resolve_subpath(self):
        pm = PathMapping(container_path="/mnt/user-data", local_path="/tmp/data")
        assert pm.resolve("/mnt/user-data/workspace/foo.py") == "/tmp/data/workspace/foo.py"

    def test_resolve_no_match(self):
        pm = PathMapping(container_path="/mnt/user-data", local_path="/tmp/data")
        assert pm.resolve("/other/path") is None

    def test_resolve_partial_prefix_no_match(self):
        """'/mnt/user-data-extra' should NOT match '/mnt/user-data'."""
        pm = PathMapping(container_path="/mnt/user-data", local_path="/tmp/data")
        assert pm.resolve("/mnt/user-data-extra/file.txt") is None

    def test_is_writable_when_not_readonly(self):
        pm = PathMapping(container_path="/mnt/data", local_path="/tmp/data", read_only=False)
        assert pm.is_writable is True

    def test_is_writable_when_readonly(self):
        pm = PathMapping(container_path="/mnt/skills", local_path="/tmp/skills", read_only=True)
        assert pm.is_writable is False


class TestResolvePath:
    def test_first_match_wins(self):
        mappings = [
            PathMapping("/mnt/user-data", "/tmp/data"),
            PathMapping("/mnt/skills", "/tmp/skills", read_only=True),
        ]
        assert resolve_path("/mnt/user-data/file.txt", mappings) == "/tmp/data/file.txt"
        assert resolve_path("/mnt/skills/my-skill", mappings) == "/tmp/skills/my-skill"

    def test_no_match_returns_original(self):
        mappings = [PathMapping("/mnt/user-data", "/tmp/data")]
        assert resolve_path("/other/file.txt", mappings) == "/other/file.txt"

    def test_empty_mappings(self):
        assert resolve_path("/any/path", []) == "/any/path"


class TestCheckWritable:
    def test_writable_mapping(self):
        mappings = [PathMapping("/mnt/data", "/tmp/data", read_only=False)]
        assert check_writable("/mnt/data/file.txt", mappings) is True

    def test_readonly_mapping(self):
        mappings = [PathMapping("/mnt/skills", "/tmp/skills", read_only=True)]
        assert check_writable("/mnt/skills/file.txt", mappings) is False

    def test_no_matching_mapping(self):
        mappings = [PathMapping("/mnt/data", "/tmp/data")]
        assert check_writable("/other/path", mappings) is True
