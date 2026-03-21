/**
 * sw.js — Service Worker
 * Cache-first strategi för Besiktningsappen
 * Offline-first PWA
 */

'use strict';

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME    = 'besiktningsappen-' + CACHE_VERSION;

// Files to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/assets/js/app.js',
  '/assets/js/handbook.js',
  '/assets/js/inspections.js',
  '/assets/js/storage.js',
  '/manifest.json',
];

// Data files (cache if available, graceful fallback if not)
const DATA_URLS = [
  '/data/handbook.json',
  '/data/checklists.json',
  '/data/inspection-types.json',
];

// ============================================================
// Install — precache core assets
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing', CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache core files (required)
      await cache.addAll(PRECACHE_URLS);

      // Cache data files (best-effort — may not exist yet)
      for (const url of DATA_URLS) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            console.log('[SW] Cached data file:', url);
          }
        } catch (err) {
          console.log('[SW] Data file not available (skipping):', url);
        }
      }

      console.log('[SW] Precache complete');
    })
  );

  // Activate immediately (don't wait for old SW to die)
  self.skipWaiting();
});

// ============================================================
// Activate — clean up old caches
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating', CACHE_NAME);

  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      const deleted = [];
      for (const name of cacheNames) {
        if (name !== CACHE_NAME && name.startsWith('besiktningsappen-')) {
          await caches.delete(name);
          deleted.push(name);
        }
      }
      if (deleted.length) console.log('[SW] Deleted old caches:', deleted);

      // Take control immediately
      await clients.claim();
    })
  );
});

// ============================================================
// Fetch — Cache-first for assets, Network-first for API/data
// ============================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, non-http, and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.origin !== self.location.origin) return;

  // API routes — network-first (don't cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Data files — network-first with cache fallback (they may update)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirstWithCacheFallback(event.request));
    return;
  }

  // Everything else — cache-first
  event.respondWith(cacheFirst(event.request));
});

// ============================================================
// Strategies
// ============================================================

/**
 * Cache-first: serve from cache, fall back to network, update cache
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

/**
 * Network-first: try network, fall back to cache
 */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

/**
 * Network-first with cache update fallback (for data files)
 */
async function networkFirstWithCacheFallback(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      console.log('[SW] Serving data file from cache (offline):', request.url);
      return cached;
    }

    // Return empty JSON so the app can handle gracefully
    return new Response(JSON.stringify(null), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============================================================
// Message — handle cache updates from app
// ============================================================
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING');
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared');
      event.ports[0] && event.ports[0].postMessage({ ok: true });
    });
  }
});
