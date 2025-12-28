// Service Worker for Note App PWA
// Version: 1.3.0 - Updated to force cache refresh for CSS fix
const CACHE_NAME = 'note-app-v4';
const RUNTIME_CACHE = 'note-app-runtime-v4';

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

  // In dev mode, don't intercept /next/static/ requests if not cached
  // This allows Next.js dev server to handle them normally
  // In production, /_next/static/ assets should be cached from build
  const isDevStaticAsset = url.pathname.startsWith('/next/static/');
  const isProdStaticAsset = url.pathname.startsWith('/_next/static/');
  
  if (isDevStaticAsset) {
    // For dev mode static assets, only intercept if cached
    // If not cached, don't intercept at all (let Next.js dev server handle it)
    // Since we can't conditionally call event.respondWith(), we check cache and only intercept if cached
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Cached - return it
          return cachedResponse;
        }
        // Not in cache - fetch it (will fail offline, but that's expected in dev mode)
        // CRITICAL: Don't catch the error - let it fail naturally so Next.js can handle it
        // This prevents the Service Worker from breaking the page with 404/503 responses
        // If offline, the fetch will fail and the browser will handle it naturally
        return fetch(request).catch((error) => {
          // In dev mode, if fetch fails (offline), just let it fail - don't return 503
          // The browser will handle the failed request naturally
          console.log('[Service Worker] Dev static asset fetch failed (offline):', url.pathname);
          throw error; // Re-throw to let browser handle it
        });
      })
    );
    return;
  }

  // Strategy: Cache First for static assets and HTML pages, Network First for API routes
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // For production static assets (_next/static), use cache-first strategy
      // This ensures route chunks work offline once loaded
      if (isProdStaticAsset) {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Not in cache, try network and cache for next time
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        }).catch(() => {
          // Network failed and not in cache - return error
          // In production, these assets should be cached from build
          return new Response('Asset not cached', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' }),
          });
        });
      }

      // Check if this is a navigation request (full page load) - CRITICAL: Handle this FIRST
      const isNavigationRequest = request.mode === 'navigate';
      
      // For HTML pages (app routes), use cache first with network fallback
      // This ensures offline navigation works even if a specific route isn't cached
      const isHtmlRequest = request.headers.get('accept')?.includes('text/html') || 
                           url.pathname === '/' ||
                           (!url.pathname.startsWith('/_next/') && !url.pathname.startsWith('/api/'));
      
      if (isHtmlRequest) {
        // CRITICAL: For navigation requests, NEVER return cached "/" - it causes infinite loops
        if (isNavigationRequest) {
          // Try to get the specific route from cache first
          if (cachedResponse) {
            // This is the actual route being requested, safe to return
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
            .catch((error) => {
              // Network failed for navigation request
              console.log('[Service Worker] Navigation request failed for:', url.pathname, 'error:', error);
              // For dashboard routes (/base/*), return app shell to allow client-side routing
              if (url.pathname.startsWith('/base/') || url.pathname.startsWith('/notebook')) {
                console.log('[Service Worker] Dashboard route detected, checking for app shell...');
                return caches.match('/').then((rootResponse) => {
                  if (rootResponse) {
                    console.log('[Service Worker] ✅ Returning app shell for dashboard route:', url.pathname);
                    return rootResponse;
                  }
                  console.warn('[Service Worker] ❌ Root HTML not cached! Cannot serve app shell for:', url.pathname);
                  // Root not cached - return offline page
                  return new Response(
                `<!DOCTYPE html>
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
    button {
      background: #22c55e;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover { background: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Offline</h1>
    <p>This page isn't cached. Please go back to a page you've visited before, or go online to load this page.</p>
    <button onclick="window.history.back()">Go Back</button>
  </div>
</body>
</html>`,
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/html',
                  }),
                }
              );
                });
              }
              
              // For non-dashboard routes, return offline page
              return new Response(
                `<!DOCTYPE html>
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
    button {
      background: #22c55e;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover { background: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Offline</h1>
    <p>This page isn't cached. Please go back to a page you've visited before, or go online to load this page.</p>
    <button onclick="window.history.back()">Go Back</button>
  </div>
</body>
</html>`,
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/html',
                  }),
                }
              );
            });
        }
        
        // For non-navigation HTML requests (e.g., fetch() calls), use cache first
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
            // Network failed
            // CRITICAL: For navigation requests, DO NOT return cached "/" as it causes infinite loops
            if (isNavigationRequest) {
              // Return a dedicated offline page instead of booting the full Next.js app
              return new Response(
                `<!DOCTYPE html>
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
    button {
      background: #22c55e;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover { background: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Offline</h1>
    <p>This page isn't cached. Please go back to a page you've visited before, or go online to load this page.</p>
    <button onclick="window.history.back()">Go Back</button>
  </div>
</body>
</html>`,
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/html',
                  }),
                }
              );
            }
            
            // For non-navigation HTML requests (e.g., fetch() calls), return root HTML
            // This allows React to load and handle client-side routing
            return caches.match('/').then((rootResponse) => {
              if (rootResponse) {
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

