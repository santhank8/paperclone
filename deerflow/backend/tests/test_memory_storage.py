"""Tests for the memory storage abstraction layer.

Covers:
  - MemoryStorage ABC contract
  - FileMemoryStorage: round-trip, caching, atomicity, per-agent isolation
  - get_memory_storage / set_memory_storage singleton management
"""

import json
import time

import pytest

from deerflow.agents.memory.storage import (
    FileMemoryStorage,
    MemoryStorage,
    _create_empty_memory,
    get_memory_storage,
    set_memory_storage,
)


# ===========================================================================
# ABC contract
# ===========================================================================


class TestMemoryStorageABC:
    def test_cannot_instantiate_abc(self):
        """MemoryStorage is abstract and cannot be instantiated directly."""
        with pytest.raises(TypeError):
            MemoryStorage()

    def test_subclass_must_implement_all_methods(self):
        """A subclass that leaves methods unimplemented cannot be instantiated."""

        class Incomplete(MemoryStorage):
            def load(self, agent_name=None):
                return {}

        with pytest.raises(TypeError):
            Incomplete()


# ===========================================================================
# _create_empty_memory
# ===========================================================================


class TestCreateEmptyMemory:
    def test_returns_valid_structure(self):
        mem = _create_empty_memory()
        assert mem["version"] == "1.0"
        assert "lastUpdated" in mem
        assert set(mem["user"]) == {"workContext", "personalContext", "topOfMind"}
        assert set(mem["history"]) == {"recentMonths", "earlierContext", "longTermBackground"}
        assert mem["facts"] == []

    def test_returns_fresh_copy_each_call(self):
        a = _create_empty_memory()
        b = _create_empty_memory()
        assert a is not b
        a["facts"].append({"id": "x"})
        assert b["facts"] == []


# ===========================================================================
# FileMemoryStorage
# ===========================================================================


class TestFileMemoryStorage:
    def test_load_nonexistent_returns_empty(self, tmp_path):
        """Loading when no file exists returns a valid empty memory structure."""
        storage = FileMemoryStorage(base_dir=tmp_path)
        data = storage.load()
        assert data["version"] == "1.0"
        assert data["facts"] == []

    def test_save_and_load_roundtrip(self, tmp_path):
        """Data survives a save/load cycle."""
        storage = FileMemoryStorage(base_dir=tmp_path)
        original = _create_empty_memory()
        original["facts"].append({"id": "fact_1", "content": "likes coffee"})
        storage.save(original)

        loaded = storage.load()
        assert len(loaded["facts"]) == 1
        assert loaded["facts"][0]["content"] == "likes coffee"

    def test_save_updates_last_updated(self, tmp_path):
        """save() stamps lastUpdated with a fresh ISO timestamp."""
        storage = FileMemoryStorage(base_dir=tmp_path)
        data = _create_empty_memory()
        old_ts = data["lastUpdated"]

        # Small pause so timestamps differ
        time.sleep(0.05)
        storage.save(data)
        assert data["lastUpdated"] != old_ts
        assert data["lastUpdated"].endswith("Z")

    def test_exists_false_initially(self, tmp_path):
        storage = FileMemoryStorage(base_dir=tmp_path)
        assert storage.exists() is False

    def test_exists_true_after_save(self, tmp_path):
        storage = FileMemoryStorage(base_dir=tmp_path)
        storage.save(_create_empty_memory())
        assert storage.exists() is True

    def test_mtime_cache_invalidation(self, tmp_path):
        """When the file is modified externally, load() returns fresh data."""
        storage = FileMemoryStorage(base_dir=tmp_path)
        mem = _create_empty_memory()
        mem["facts"].append({"id": "fact_a", "content": "original"})
        storage.save(mem)

        # First load populates cache
        cached = storage.load()
        assert cached["facts"][0]["content"] == "original"

        # Externally overwrite the file
        file_path = tmp_path / "memory.json"
        modified = _create_empty_memory()
        modified["facts"].append({"id": "fact_b", "content": "modified externally"})

        # Ensure mtime changes (some filesystems have 1s granularity)
        time.sleep(0.05)
        with open(file_path, "w") as f:
            json.dump(modified, f)

        # Load must detect the mtime change and return fresh data
        reloaded = storage.load()
        assert reloaded["facts"][0]["content"] == "modified externally"

    def test_invalidate_cache_forces_reload(self, tmp_path):
        """invalidate_cache() drops the cached entry so the next load() re-reads."""
        storage = FileMemoryStorage(base_dir=tmp_path)
        storage.save(_create_empty_memory())

        # Populate cache
        storage.load()
        assert None in storage._cache

        storage.invalidate_cache()
        assert None not in storage._cache

    def test_per_agent_isolation(self, tmp_path):
        """Global memory and per-agent memory are stored in separate files."""
        storage = FileMemoryStorage(base_dir=tmp_path)

        global_mem = _create_empty_memory()
        global_mem["facts"].append({"id": "g1", "content": "global fact"})
        storage.save(global_mem)

        agent_mem = _create_empty_memory()
        agent_mem["facts"].append({"id": "a1", "content": "agent fact"})
        storage.save(agent_mem, agent_name="alice")

        # Verify isolation
        g = storage.load()
        a = storage.load(agent_name="alice")
        assert g["facts"][0]["content"] == "global fact"
        assert a["facts"][0]["content"] == "agent fact"

        # Verify file paths are distinct
        assert (tmp_path / "memory.json").exists()
        assert (tmp_path / "agents" / "alice" / "memory.json").exists()

    def test_atomic_write_no_tmp_left(self, tmp_path):
        """After a successful save, no .tmp file should remain."""
        storage = FileMemoryStorage(base_dir=tmp_path)
        storage.save(_create_empty_memory())

        tmp_files = list(tmp_path.glob("*.tmp"))
        assert tmp_files == [], f"Leftover temp files: {tmp_files}"

    def test_save_returns_true_on_success(self, tmp_path):
        storage = FileMemoryStorage(base_dir=tmp_path)
        assert storage.save(_create_empty_memory()) is True

    def test_load_corrupt_file_returns_empty(self, tmp_path):
        """A corrupt JSON file should not crash; load returns empty memory."""
        storage = FileMemoryStorage(base_dir=tmp_path)
        bad_file = tmp_path / "memory.json"
        bad_file.write_text("{invalid json!!!")

        data = storage.load()
        assert data["version"] == "1.0"
        assert data["facts"] == []


# ===========================================================================
# Singleton management
# ===========================================================================


class TestGetMemoryStorage:
    def setup_method(self):
        # Reset singleton before each test
        set_memory_storage(None)

    def teardown_method(self):
        set_memory_storage(None)

    def test_returns_file_storage_by_default(self):
        storage = get_memory_storage()
        assert isinstance(storage, FileMemoryStorage)

    def test_returns_same_instance(self):
        a = get_memory_storage()
        b = get_memory_storage()
        assert a is b

    def test_set_memory_storage_overrides(self, tmp_path):
        custom = FileMemoryStorage(base_dir=tmp_path)
        set_memory_storage(custom)
        assert get_memory_storage() is custom

    def test_set_none_resets(self):
        first = get_memory_storage()
        set_memory_storage(None)
        second = get_memory_storage()
        assert first is not second
        assert isinstance(second, FileMemoryStorage)
