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
                    // First install - no action needed
                    console.log('[Service Worker] Initial install complete');
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

