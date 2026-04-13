"""Tests for memory import/export."""

import pytest

from deerflow.agents.memory.storage import FileMemoryStorage, _create_empty_memory, get_memory_storage, set_memory_storage
from deerflow.agents.memory.updater import get_memory_data, import_memory_data


@pytest.fixture(autouse=True)
def _use_tmp_storage(tmp_path):
    storage = FileMemoryStorage(base_dir=tmp_path)
    set_memory_storage(storage)
    yield
    set_memory_storage(None)


def _make_memory(facts=None, work_summary="", work_updated_at=""):
    data = _create_empty_memory()
    if facts:
        data["facts"] = facts
    if work_summary:
        data["user"]["workContext"]["summary"] = work_summary
        data["user"]["workContext"]["updatedAt"] = work_updated_at or "2026-01-01T00:00:00Z"
    return data


class TestImportReplace:
    def test_import_replaces_entirely(self):
        get_memory_storage().save(_make_memory([{"id": "f1", "content": "old", "category": "knowledge", "confidence": 0.9, "createdAt": "", "source": "t1"}]))
        new_data = _make_memory([{"id": "f2", "content": "new", "category": "knowledge", "confidence": 0.9, "createdAt": "", "source": "t1"}])
        result = import_memory_data(new_data, merge=False)
        assert result is True
        loaded = get_memory_data()
        assert len(loaded["facts"]) == 1
        assert loaded["facts"][0]["id"] == "f2"

    def test_import_empty_clears(self):
        get_memory_storage().save(_make_memory([{"id": "f1", "content": "test", "category": "knowledge", "confidence": 0.9, "createdAt": "", "source": "t1"}]))
        result = import_memory_data(_make_memory(), merge=False)
        assert result is True
        assert get_memory_data()["facts"] == []


class TestImportMerge:
    def test_merge_adds_new_facts(self):
        get_memory_storage().save(_make_memory([{"id": "f1", "content": "existing", "category": "knowledge", "confidence": 0.9, "createdAt": "", "source": "t1"}]))
        new_data = _make_memory([{"id": "f2", "content": "new", "category": "knowledge", "confidence": 0.9, "createdAt": "", "source": "t1"}])
        result = import_memory_data(new_data, merge=True)
        assert result is True
        loaded = get_memory_data()
        ids = [f["id"] for f in loaded["facts"]]
        assert "f1" in ids
        assert "f2" in ids

    def test_merge_deduplicates_by_id(self):
        get_memory_storage().save(_make_memory([{"id": "f1", "content": "v1", "category": "knowledge", "confidence": 0.9, "createdAt": "", "source": "t1"}]))
        new_data = _make_memory([{"id": "f1", "content": "v2", "category": "knowledge", "confidence": 0.9, "createdAt": "", "source": "t1"}])
        result = import_memory_data(new_data, merge=True)
        assert result is True
        loaded = get_memory_data()
        assert len(loaded["facts"]) == 1
        assert loaded["facts"][0]["content"] == "v2"  # newer wins

    def test_merge_keeps_newer_summaries(self):
        old = _make_memory(work_summary="old work", work_updated_at="2025-01-01T00:00:00Z")
        get_memory_storage().save(old)

        new = _make_memory(work_summary="new work", work_updated_at="2026-06-01T00:00:00Z")
        import_memory_data(new, merge=True)

        loaded = get_memory_data()
        assert loaded["user"]["workContext"]["summary"] == "new work"

    def test_merge_keeps_older_if_import_is_older(self):
        old = _make_memory(work_summary="keep this", work_updated_at="2026-06-01T00:00:00Z")
        get_memory_storage().save(old)

        new = _make_memory(work_summary="dont use this", work_updated_at="2025-01-01T00:00:00Z")
        import_memory_data(new, merge=True)

        loaded = get_memory_data()
        assert loaded["user"]["workContext"]["summary"] == "keep this"
