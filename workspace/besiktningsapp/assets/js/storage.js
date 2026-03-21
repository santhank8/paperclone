/**
 * storage.js — Besiktningsappen
 * IndexedDB wrapper: CRUD + export for inspections
 * Offline-first, no external dependencies
 */

'use strict';

const StorageModule = (() => {

  const DB_NAME    = 'besiktningsappen';
  const DB_VERSION = 1;
  const STORE_NAME = 'besiktningar';

  let _db = null;

  // ============================================================
  // Init / Open DB
  // ============================================================
  function open() {
    if (_db) return Promise.resolve(_db);

    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.error('[Storage] IndexedDB not supported');
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create store if not exists
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status',  'status',  { unique: false });
          store.createIndex('datum',   'datum',   { unique: false });
          store.createIndex('andrad',  'andrad',  { unique: false });
        }
      };

      request.onsuccess = (event) => {
        _db = event.target.result;

        _db.onerror = (e) => {
          console.error('[Storage] DB error:', e.target.error);
        };

        resolve(_db);
      };

      request.onerror = (event) => {
        console.error('[Storage] Failed to open DB:', event.target.error);
        reject(event.target.error);
      };

      request.onblocked = () => {
        console.warn('[Storage] DB blocked — close other tabs and reload');
      };
    });
  }

  // ============================================================
  // Transaction helper
  // ============================================================
  function _tx(mode) {
    return open().then(db => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      return store;
    });
  }

  function _promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror   = () => reject(request.error);
    });
  }

  // ============================================================
  // CRUD
  // ============================================================

  /**
   * Create a new inspection
   * @param {Object} inspection — must have .id
   * @returns {Promise<string>} id
   */
  async function create(inspection) {
    inspection.skapad  = inspection.skapad  || new Date().toISOString();
    inspection.andrad  = new Date().toISOString();
    inspection.status  = inspection.status  || 'ongoing';

    const store = await _tx('readwrite');
    await _promisify(store.add(inspection));
    return inspection.id;
  }

  /**
   * Get a single inspection by id
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async function get(id) {
    const store = await _tx('readonly');
    const result = await _promisify(store.get(id));
    return result || null;
  }

  /**
   * Get all inspections, sorted by andrad desc
   * @returns {Promise<Object[]>}
   */
  async function getAll() {
    const store = await _tx('readonly');
    const all = await _promisify(store.getAll());
    return (all || []).sort((a, b) => {
      const da = new Date(a.andrad || 0).getTime();
      const db = new Date(b.andrad || 0).getTime();
      return db - da;
    });
  }

  /**
   * Update an inspection (full replace)
   * @param {string} id
   * @param {Object} inspection
   * @returns {Promise<void>}
   */
  async function update(id, inspection) {
    inspection.id     = id;
    inspection.andrad = new Date().toISOString();
    const store = await _tx('readwrite');
    await _promisify(store.put(inspection));
  }

  /**
   * Update a specific field path in an inspection
   * @param {string} id
   * @param {string} path - dot-separated field path, e.g. 'objekt.adress'
   * @param {*} value
   */
  async function updateField(id, path, value) {
    const inspection = await get(id);
    if (!inspection) throw new Error('Inspection not found: ' + id);

    const parts = path.split('.');
    let obj = inspection;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] === undefined) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;

    await update(id, inspection);
  }

  /**
   * Delete an inspection
   * @param {string} id
   */
  async function remove(id) {
    const store = await _tx('readwrite');
    await _promisify(store.delete(id));
  }

  /**
   * Get inspections by status
   * @param {string} status - 'ongoing' | 'completed' | 'signed'
   */
  async function getByStatus(status) {
    const all = await getAll();
    return all.filter(i => i.status === status);
  }

  // ============================================================
  // Export
  // ============================================================

  /**
   * Export an inspection as JSON blob and trigger download
   * @param {string} id
   */
  async function exportAsJSON(id) {
    const inspection = await get(id);
    if (!inspection) throw new Error('Inspection not found: ' + id);

    const filename = `besiktning-${inspection.objekt?.fastighetsbeteckning || id}-${(inspection.datum || '').slice(0,10)}.json`
      .replace(/[^a-z0-9-_.]/gi, '_');

    const json = JSON.stringify(inspection, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return filename;
  }

  /**
   * Export all inspections as JSON
   */
  async function exportAllAsJSON() {
    const all = await getAll();
    const json = JSON.stringify(all, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `besiktningar-export-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import inspections from JSON file
   * @param {File} file
   * @returns {Promise<number>} count of imported inspections
   */
  async function importFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const list = Array.isArray(data) ? data : [data];
          let count = 0;

          for (const inspection of list) {
            if (!inspection.id) inspection.id = 'bes-' + Date.now() + '-' + count;
            const existing = await get(inspection.id);
            if (existing) {
              await update(inspection.id, inspection);
            } else {
              await create(inspection);
            }
            count++;
          }

          resolve(count);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  // ============================================================
  // Storage info
  // ============================================================
  async function getStorageInfo() {
    const all = await getAll();
    let totalBytes = 0;

    try {
      totalBytes = new TextEncoder().encode(JSON.stringify(all)).length;
    } catch (e) {
      totalBytes = 0;
    }

    let quota = null;
    if (navigator.storage && navigator.storage.estimate) {
      quota = await navigator.storage.estimate();
    }

    return {
      count: all.length,
      totalBytes,
      totalMB: (totalBytes / 1024 / 1024).toFixed(2),
      quota,
    };
  }

  // ============================================================
  // Auto-open on load
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    open().catch(err => {
      console.error('[Storage] Failed to initialize IndexedDB:', err);
    });
  });

  // ============================================================
  // Public API
  // ============================================================
  return {
    open,
    create,
    get,
    getAll,
    update,
    updateField,
    remove,
    getByStatus,
    exportAsJSON,
    exportAllAsJSON,
    importFromJSON,
    getStorageInfo,
  };

})();

window.StorageModule = StorageModule;
