"""Storage abstraction for the memory subsystem.

Provides an ABC (MemoryStorage) and a file-based implementation
(FileMemoryStorage) with mtime-based caching and atomic writes.
"""

import json
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any

from deerflow.config.memory_config import get_memory_config
from deerflow.config.paths import get_paths


def _create_empty_memory() -> dict[str, Any]:
    """Create an empty memory structure."""
    return {
        "version": "1.0",
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "user": {
            "workContext": {"summary": "", "updatedAt": ""},
            "personalContext": {"summary": "", "updatedAt": ""},
            "topOfMind": {"summary": "", "updatedAt": ""},
        },
        "history": {
            "recentMonths": {"summary": "", "updatedAt": ""},
            "earlierContext": {"summary": "", "updatedAt": ""},
            "longTermBackground": {"summary": "", "updatedAt": ""},
        },
        "facts": [],
    }


class MemoryStorage(ABC):
    """Abstract base class for memory persistence backends."""

    @abstractmethod
    def load(self, agent_name: str | None = None) -> dict[str, Any]:
        """Load memory data for the given agent (or global if None).

        Returns a valid memory dict; implementations must return an empty
        memory structure when no persisted data exists.
        """

    @abstractmethod
    def save(self, data: dict[str, Any], agent_name: str | None = None) -> bool:
        """Persist *data* as the memory for *agent_name* (or global).

        Returns True on success, False on failure.
        """

    @abstractmethod
    def exists(self, agent_name: str | None = None) -> bool:
        """Return True if persisted memory exists for the given agent."""


class FileMemoryStorage(MemoryStorage):
    """File-based memory storage with mtime caching and atomic writes."""

    def __init__(self, base_dir: str | Path | None = None) -> None:
        """Initialise a file-backed memory store.

        Args:
            base_dir: Optional override for the base directory.  When set,
                      path resolution bypasses config and uses *base_dir*
                      directly (handy for testing).  When None, paths come
                      from ``get_paths()`` / ``get_memory_config()``.
        """
        self._base_dir: Path | None = Path(base_dir) if base_dir is not None else None
        # Per-agent cache: agent_name -> (memory_data, file_mtime)
        self._cache: dict[str | None, tuple[dict[str, Any], float | None]] = {}

    # -- path helpers ---------------------------------------------------------

    def _get_file_path(self, agent_name: str | None = None) -> Path:
        """Resolve the memory file path for *agent_name* (or global)."""
        if self._base_dir is not None:
            # Simplified resolution for testing / explicit base_dir
            if agent_name is not None:
                return self._base_dir / "agents" / agent_name.lower() / "memory.json"
            return self._base_dir / "memory.json"

        # Production resolution via config singletons
        if agent_name is not None:
            return get_paths().agent_memory_file(agent_name)

        config = get_memory_config()
        if config.storage_path:
            p = Path(config.storage_path)
            return p if p.is_absolute() else get_paths().base_dir / p
        return get_paths().memory_file

    # -- public interface -----------------------------------------------------

    def load(self, agent_name: str | None = None) -> dict[str, Any]:
        """Load memory data with mtime-based cache invalidation."""
        file_path = self._get_file_path(agent_name)

        # Current file modification time
        try:
            current_mtime = file_path.stat().st_mtime if file_path.exists() else None
        except OSError:
            current_mtime = None

        cached = self._cache.get(agent_name)

        if cached is not None and cached[1] == current_mtime:
            return cached[0]

        # Cache miss or stale -- reload from disk
        memory_data = self._read_file(file_path)
        self._cache[agent_name] = (memory_data, current_mtime)
        return memory_data

    def save(self, data: dict[str, Any], agent_name: str | None = None) -> bool:
        """Atomically write memory data and update cache."""
        file_path = self._get_file_path(agent_name)

        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Stamp the save time
            data["lastUpdated"] = datetime.utcnow().isoformat() + "Z"

            # Atomic write: temp file + rename
            temp_path = file_path.with_suffix(".tmp")
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            temp_path.replace(file_path)

            # Refresh cache
            try:
                mtime = file_path.stat().st_mtime
            except OSError:
                mtime = None
            self._cache[agent_name] = (data, mtime)

            print(f"Memory saved to {file_path}")
            return True
        except OSError as e:
            print(f"Failed to save memory file: {e}")
            return False

    def exists(self, agent_name: str | None = None) -> bool:
        """Check whether a memory file exists on disk."""
        return self._get_file_path(agent_name).exists()

    def invalidate_cache(self, agent_name: str | None = None) -> None:
        """Remove the cache entry for *agent_name* so the next load() re-reads disk."""
        self._cache.pop(agent_name, None)

    # -- internal helpers -----------------------------------------------------

    @staticmethod
    def _read_file(file_path: Path) -> dict[str, Any]:
        """Read and parse a memory JSON file, returning empty memory on failure."""
        if not file_path.exists():
            return _create_empty_memory()
        try:
            with open(file_path, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"Failed to load memory file: {e}")
            return _create_empty_memory()


# -- singleton ----------------------------------------------------------------

_storage: MemoryStorage | None = None


def get_memory_storage() -> MemoryStorage:
    """Return the global MemoryStorage singleton (lazy-initialised)."""
    global _storage
    if _storage is None:
        _storage = FileMemoryStorage()
    return _storage


def set_memory_storage(storage: MemoryStorage | None) -> None:
    """Replace the global MemoryStorage singleton.

    Pass ``None`` to reset to the default (next ``get_memory_storage()``
    call will create a fresh ``FileMemoryStorage``).
    """
    global _storage
    _storage = storage
