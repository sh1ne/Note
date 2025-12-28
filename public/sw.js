// Service Worker for Note App PWA
// Version: 2.0.0 - Production-only, simplified 3-lane architecture
const CACHE_NAME = 'note-app-v5';
const RUNTIME_CACHE = 'note-app-runtime-v5';

// Assets to cache immediately (app shell)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
];

// Shared offline HTML template
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - Note App</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #000;
      color: #fff;
      text-align: center;
      padding: 20px;
    }
    .container {
      max-width: 400px;
    }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { font-size: 14px; line-height: 1.5; color: #aaa; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Offline</h1>
    <p>App not cached yet. Please go online once to load the app, then it will work offline.</p>
  </div>
</body>
</html>`;

// Install event - cache app shell
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Caching app shell');
      await cache.addAll(STATIC_ASSETS);
      // Verify root HTML is cached (critical for offline navigation)
      const rootResponse = await cache.match('/');
      if (!rootResponse) {
        console.warn('[Service Worker] Root HTML not cached, attempting to fetch...');
        try {
          const fetchResponse = await fetch('/');
          if (fetchResponse.ok) {
            await cache.put('/', fetchResponse.clone());
            console.log('[Service Worker] Root HTML cached successfully');
          }
        } catch (error) {
          console.error('[Service Worker] Failed to cache root HTML:', error);
        }
      } else {
        console.log('[Service Worker] Root HTML verified in cache');
      }
    })
  );
  // Force activation of new service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Delete old caches
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      ).then(() => {
        // Take control of all pages immediately (must be inside waitUntil)
        console.log('[Service Worker] Claiming clients...');
        return self.clients.claim();
      });
    })
  );
});

// Fetch event - 3 deterministic lanes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (Firebase, external APIs)
  if (url.origin !== self.location.origin) {
    return;
  }

  const isNavigationRequest = request.mode === 'navigate';
  const isBaseRoute = url.pathname.startsWith('/base/') || url.pathname.startsWith('/notebook');
  const isStaticAsset = url.pathname.startsWith('/_next/static/');

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // ============================================
      // LANE A: /_next/static/* (Static Assets)
      // ============================================
      if (isStaticAsset) {
        // CacheFirst strategy
        if (cachedResponse) {
          return cachedResponse;
        }
        // Not in cache, try network and cache for next time
        return fetch(request)
          .then((response) => {
            if (response.status === 200) {
              const responseToCache = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            // Network failed and not in cache - return 503 text
            return new Response('missing static asset', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' }),
            });
          });
      }

      // ============================================
      // LANE B: Navigation requests for /base/*
      // ============================================
      if (isNavigationRequest && isBaseRoute) {
        // ALWAYS return the cached app shell "/" for /base/* routes
        // This allows Next.js client-side routing to handle the route
        return caches.match('/').then((rootResponse) => {
          if (rootResponse) {
            console.log('[Service Worker] ✅ Returning app shell for /base/* route:', url.pathname);
            return rootResponse;
          }
          // Root not cached - return minimal offline HTML (NOT the generic "page isn't cached")
          console.warn('[Service Worker] ❌ Root HTML not cached, returning minimal offline page');
          return new Response(OFFLINE_HTML, {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/html' }),
          });
        });
      }

      // ============================================
      // LANE C: Everything else
      // ============================================
      if (isNavigationRequest) {
        // Other navigation requests: NetworkFirst, cache on 200, offline fallback
        return fetch(request)
          .then((response) => {
            if (response.status === 200) {
              const responseToCache = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            // Network failed, try cache
            if (cachedResponse) {
              return cachedResponse;
            }
            // No cache, return offline HTML
            return new Response(OFFLINE_HTML, {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/html' }),
            });
          });
      }

      // Non-navigation requests: NetworkFirst with cache fallback
      return fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          if (cachedResponse) {
            return cachedResponse;
          }
          // If no cache, return error
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' }),
          });
        });
    })
  );
});

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Received SKIP_WAITING message');
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[Service Worker] Received CLEAR_CACHE message');
    caches.delete(CACHE_NAME);
    caches.delete(RUNTIME_CACHE);
  }
  if (event.data && event.data.type === 'CLAIM_CLIENTS') {
    console.log('[Service Worker] Received CLAIM_CLIENTS message');
    self.clients.claim().then(() => {
      console.log('[Service Worker] Successfully claimed clients');
    }).catch((error) => {
      console.error('[Service Worker] Failed to claim clients:', error);
    });
  }
});
