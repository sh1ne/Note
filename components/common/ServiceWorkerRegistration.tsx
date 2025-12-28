'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker
      let updateInterval: NodeJS.Timeout | null = null;
      
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[Service Worker] Registered successfully:', registration.scope);
          
          // Check if service worker is already controlling
          if (navigator.serviceWorker.controller) {
            console.log('[Service Worker] Already controlling page');
          } else {
            console.log('[Service Worker] Not yet controlling - checking state...');
            
            // Helper to activate a worker
            const activateWorker = (worker: ServiceWorker) => {
              if (worker.state === 'installed' || worker.state === 'waiting') {
                console.log(`[Service Worker] Activating ${worker.state} worker...`);
                worker.postMessage({ type: 'SKIP_WAITING' });
              }
            };
            
            // Check for waiting worker (already installed, just waiting)
            if (registration.waiting) {
              console.log('[Service Worker] Found waiting worker, activating...');
              activateWorker(registration.waiting);
            }
            
            // Check for installing worker (still installing)
            if (registration.installing) {
              console.log('[Service Worker] Found installing worker, will activate when ready');
              const installingWorker = registration.installing;
              
              // Listen for state changes
              installingWorker.addEventListener('statechange', () => {
                console.log(`[Service Worker] Installing worker state changed to: ${installingWorker.state}`);
                if (installingWorker.state === 'installed' || installingWorker.state === 'waiting') {
                  if (!navigator.serviceWorker.controller) {
                    console.log('[Service Worker] Installing worker ready, activating...');
                    activateWorker(installingWorker);
                  }
                }
              });
              
              // Also check current state (might already be installed)
              if (installingWorker.state === 'installed' || installingWorker.state === 'waiting') {
                activateWorker(installingWorker);
              }
            }
            
            // Also check active worker (might be active but not controlling yet)
            if (registration.active && !navigator.serviceWorker.controller) {
              console.log('[Service Worker] Found active worker but not controlling');
              // If there's an active worker but no controller, try to claim clients
              if (registration.active.state === 'activated') {
                console.log('[Service Worker] Active worker is activated, sending CLAIM_CLIENTS message...');
                registration.active.postMessage({ type: 'CLAIM_CLIENTS' });
                // If still not controlling after a short delay, reload to let it take control
                setTimeout(() => {
                  if (!navigator.serviceWorker.controller) {
                    console.log('[Service Worker] Still not controlling after claim attempt, reloading...');
                    window.location.reload();
                  } else {
                    console.log('[Service Worker] Successfully claimed clients!');
                  }
                }, 500);
              }
            }
          }

          // Check for updates periodically
          updateInterval = setInterval(() => {
            registration.update();
          }, 60000); // Check every minute

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New service worker available - auto-skip-waiting and reload
                    console.log('[Service Worker] New version available, activating...');
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    // Wait a moment for skipWaiting to process, then reload
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                  } else {
                    // First install - activate immediately
                    console.log('[Service Worker] Initial install complete, activating...');
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[Service Worker] Registration failed:', error);
        });

      // Handle service worker updates
      // Only reload if there's actually a new service worker (not on initial install)
      let refreshing = false;
      let hasExistingController = !!navigator.serviceWorker.controller;
      
      const handleControllerChange = () => {
        // Only reload if we had an existing controller (meaning this is an update, not initial install)
        // This prevents reload loops on first load
        if (!refreshing && hasExistingController) {
          refreshing = true;
          console.log('[Service Worker] New version activated, reloading in 2 seconds...');
          // Wait a moment to ensure any pending saves complete
          setTimeout(() => {
            window.location.reload();
          }, 2000); // Reduced from 4s to 2s for better UX
        } else if (!hasExistingController) {
          // First install - just log, don't reload
          console.log('[Service Worker] Initial install complete, no reload needed');
        }
      };
      
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      
      // Cleanup function
      return () => {
        if (updateInterval) {
          clearInterval(updateInterval);
        }
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  return null;
}

