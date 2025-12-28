'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerDebug() {
  const [swInfo, setSwInfo] = useState<{
    version: string;
    cacheNames: string[];
    hasController: boolean;
    isOnline: boolean;
  } | null>(null);

  useEffect(() => {
    // Only show if localStorage flag is set (works in both dev and production)
    // In production, user must enable via: localStorage.setItem('sw-debug', 'true')
    if (typeof window === 'undefined') return;
    
    const showDebug = localStorage.getItem('sw-debug') === 'true';
    if (!showDebug) return;

    const updateInfo = async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
      }

      const hasController = !!navigator.serviceWorker.controller;
      const isOnline = navigator.onLine;

      // Get cache names
      let cacheNames: string[] = [];
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          cacheNames = names.filter(name => name.includes('note-app'));
        }
      } catch (e) {
        // Ignore
      }

      setSwInfo({
        version: '2.0.0',
        cacheNames,
        hasController,
        isOnline,
      });
    };

    updateInfo();
    
    // Update on online/offline changes
    window.addEventListener('online', updateInfo);
    window.addEventListener('offline', updateInfo);
    
    // Update when SW controller changes
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', updateInfo);
    }

    return () => {
      window.removeEventListener('online', updateInfo);
      window.removeEventListener('offline', updateInfo);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', updateInfo);
      }
    };
  }, []);

  // Only show if flag is set
  if (typeof window === 'undefined') return null;
  
  const showDebug = localStorage.getItem('sw-debug') === 'true';
  if (!showDebug || !swInfo) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: swInfo.hasController ? '#22c55e' : '#ef4444',
        color: 'white',
        padding: '4px 8px',
        fontSize: '10px',
        fontFamily: 'monospace',
        zIndex: 9999,
        textAlign: 'center',
        lineHeight: '1.4',
      }}
    >
      <div>
        SW v{swInfo.version} | 
        Controller: {swInfo.hasController ? '✅' : '❌'} | 
        Online: {swInfo.isOnline ? '✅' : '❌'} | 
        Caches: {swInfo.cacheNames.length > 0 ? swInfo.cacheNames.join(', ') : 'none'}
      </div>
    </div>
  );
}

