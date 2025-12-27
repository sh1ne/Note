'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { isAuthenticated } from '@/lib/utils/authState';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirectedRef = useRef(false);
  const authResolvedOnceRef = useRef(false); // Track if auth has been established once
  const canRedirectRef = useRef(true); // Can we redirect? Disabled once auth is trusted
  const [hasIndexedDBAuth, setHasIndexedDBAuth] = useState<boolean | null>(null);

  // Check IndexedDB auth state ONCE per session (source of truth)
  // This runs on mount and when loading completes, but only checks once
  useEffect(() => {
    // Only check if we haven't resolved auth yet
    if (authResolvedOnceRef.current) {
      return; // Already resolved, don't re-check
    }

    // Wait for AuthContext to finish loading before checking IndexedDB
    if (!loading) {
      const checkIndexedDBAuth = async () => {
        try {
          const authenticated = await isAuthenticated();
          setHasIndexedDBAuth(authenticated);
          authResolvedOnceRef.current = true; // Mark as resolved
          
          // CRITICAL: Once auth is established, disable redirects permanently
          // This prevents any future redirects during navigation
          if (authenticated) {
            canRedirectRef.current = false;
            console.log('[DashboardLayout] Auth established - redirects permanently disabled');
          }
          
          console.log('[DashboardLayout] Checked IndexedDB auth state:', authenticated);
        } catch (error) {
          console.error('[DashboardLayout] Error checking IndexedDB auth:', error);
          setHasIndexedDBAuth(false);
          authResolvedOnceRef.current = true; // Mark as resolved even on error
        }
      };
      checkIndexedDBAuth();
    }
  }, [loading]);

  useEffect(() => {
    // CRITICAL: If redirects are disabled (auth was established), NEVER redirect
    // This is the permanent gate that prevents redirects after auth is trusted
    if (!canRedirectRef.current) {
      return; // Redirects permanently disabled - auth was established
    }

    // CRITICAL: Never redirect if we're still checking IndexedDB auth state
    // This prevents race conditions during initial load
    if (hasIndexedDBAuth === null) {
      return; // Still checking, don't redirect yet
    }
    
    // CRITICAL: Never redirect if we've already redirected once
    if (hasRedirectedRef.current) {
      return;
    }
    
    if (!loading) {
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      const isOnDashboardRoute = pathname && pathname !== '/login' && pathname !== '/signup' && pathname !== '/';
      
      // CRITICAL: If IndexedDB has auth state, allow rendering and disable redirects permanently
      // This is the source of truth for authentication
      if (hasIndexedDBAuth) {
        // IndexedDB says we're authenticated - disable redirects permanently
        canRedirectRef.current = false;
        console.log('[DashboardLayout] IndexedDB has auth state - redirects permanently disabled');
        return;
      }
      
      // CRITICAL: If we're on a dashboard route, NEVER redirect
      // This prevents redirects during navigation between notes
      if (isOnDashboardRoute) {
        console.log('[DashboardLayout] On dashboard route - preventing redirect');
        return; // Never redirect when on dashboard route
      }
      
      // Only redirect if: IndexedDB is empty AND online AND no user AND not on dashboard route
      // AND redirects are still enabled (auth not yet established)
      if (!user && !isOffline && !hasIndexedDBAuth && canRedirectRef.current) {
        // Online, no user, no IndexedDB auth state, not on dashboard - redirect to login
        console.log('[DashboardLayout] No auth state - redirecting to login');
        hasRedirectedRef.current = true;
        router.push('/login');
      } else if (!user && isOffline && !hasIndexedDBAuth && canRedirectRef.current) {
        // Offline, no user, no IndexedDB auth, not on dashboard route - redirect to login
        console.log('[DashboardLayout] Offline, no auth state, not on dashboard - redirecting to login');
        hasRedirectedRef.current = true;
        router.push('/login');
      }
    }
  }, [user, loading, router, pathname, hasIndexedDBAuth]);

  if (loading || hasIndexedDBAuth === null) {
    return <LoadingSpinner message="Loading..." />;
  }

  // Allow rendering if we have a user OR if IndexedDB has auth state
  // IndexedDB is the source of truth
  const shouldRender = user || hasIndexedDBAuth;

  if (!shouldRender) {
    return null;
  }

  return <>{children}</>;
}

