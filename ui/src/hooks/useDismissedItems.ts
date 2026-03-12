import { useCallback, useSyncExternalStore } from "react";

const DISMISSED_KEY = "paperclip:inbox:dismissed";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

// Module-level listeners and snapshot for useSyncExternalStore.
// All components share the same snapshot, so Sidebar updates
// immediately when Inbox calls dismiss().
let listeners: Array<() => void> = [];
let snapshot = loadDismissed();

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function emitChange() {
  snapshot = loadDismissed();
  for (const listener of listeners) {
    listener();
  }
}

// Sync across tabs / windows
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === DISMISSED_KEY) emitChange();
  });
}

export function useDismissedItems() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const dismiss = useCallback((id: string) => {
    const next = new Set(loadDismissed());
    next.add(id);
    saveDismissed(next);
    emitChange();
  }, []);

  const pruneStale = useCallback((currentIds: Set<string>) => {
    const stored = loadDismissed();
    let changed = false;
    for (const id of stored) {
      if (!currentIds.has(id)) {
        stored.delete(id);
        changed = true;
      }
    }
    if (changed) {
      saveDismissed(stored);
      emitChange();
    }
  }, []);

  return { dismissed, dismiss, pruneStale };
}
