"""Centralized file operation locks using WeakValueDictionary.

Prevents unbounded memory growth in long-running processes by
automatically dropping lock entries when no thread holds a reference.
"""

import threading
import weakref

_LockKey = tuple[str, str]  # (sandbox_id, path)
_FILE_OPERATION_LOCKS: weakref.WeakValueDictionary[_LockKey, threading.Lock] = weakref.WeakValueDictionary()
_REGISTRY_LOCK = threading.Lock()


def get_file_lock(sandbox_id: str, path: str) -> threading.Lock:
    """Get or create a lock for a specific file in a sandbox.

    The lock is automatically garbage collected when no thread holds
    a reference to it (via WeakValueDictionary).
    """
    key: _LockKey = (sandbox_id, path)
    with _REGISTRY_LOCK:
        lock = _FILE_OPERATION_LOCKS.get(key)
        if lock is None:
            lock = threading.Lock()
            _FILE_OPERATION_LOCKS[key] = lock
        return lock
