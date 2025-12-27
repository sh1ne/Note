// Service Worker for Note App PWA
// Version: 1.0.0
const CACHE_NAME = 'note-app-v1';
const RUNTIME_CACHE = 'note-app-runtime-v1';

// Assets to cache immediately (app shell)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
];

// Install event - cache app shell
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(STATIC_ASSETS);
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
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
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

  // Strategy: Cache First for static assets and HTML pages, Network First for API routes
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // For static assets (_next/static), use cache first
      if (url.pathname.startsWith('/_next/static/')) {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      }

      // For HTML pages (app routes), use cache first with network fallback
      // This ensures offline navigation works even if a specific route isn't cached
      const isHtmlRequest = request.headers.get('accept')?.includes('text/html') || 
                           url.pathname === '/' ||
                           (!url.pathname.startsWith('/_next/') && !url.pathname.startsWith('/api/'));
      
      if (isHtmlRequest) {
        // Try cache first for HTML pages
        if (cachedResponse) {
          // Also try to update cache in background (will fail silently if offline)
          fetch(request).then((response) => {
            if (response.status === 200) {
              const responseToCache = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
          }).catch(() => {
            // Ignore background update failures (e.g., when offline)
          });
          return cachedResponse;
        }
        
        // Not in cache, try network
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
            // Network failed, try to return app shell (root HTML)
            // This allows React to load and handle client-side routing
            return caches.match('/').then((rootResponse) => {
              if (rootResponse) {
                // Return the root HTML so React can load and handle routing
                return rootResponse;
              }
              // Last resort: return offline message
              return new Response('Offline', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain',
                }),
              });
            });
          });
      }

      // For API routes and other requests, use network first with cache fallback
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
            headers: new Headers({
              'Content-Type': 'text/plain',
            }),
          });
        });
    })
  );
});

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
    caches.delete(RUNTIME_CACHE);
  }
});

