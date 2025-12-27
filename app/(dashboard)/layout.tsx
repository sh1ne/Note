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
  const [hasIndexedDBAuth, setHasIndexedDBAuth] = useState<boolean | null>(null);

  // Check IndexedDB auth state (source of truth) - but only after AuthContext finishes loading
  useEffect(() => {
    if (!loading) {
      // Wait for AuthContext to finish loading before checking IndexedDB
      // This prevents race conditions where we check before migration completes
      const checkIndexedDBAuth = async () => {
        try {
          const authenticated = await isAuthenticated();
          setHasIndexedDBAuth(authenticated);
          console.log('[DashboardLayout] Checked IndexedDB auth state:', authenticated);
        } catch (error) {
          console.error('[DashboardLayout] Error checking IndexedDB auth:', error);
          setHasIndexedDBAuth(false);
        }
      };
      checkIndexedDBAuth();
    }
  }, [loading]);

  useEffect(() => {
    if (!loading && hasIndexedDBAuth !== null && !hasRedirectedRef.current) {
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      const isOnDashboardRoute = pathname && pathname !== '/login' && pathname !== '/signup' && pathname !== '/';
      
      // CRITICAL: If IndexedDB has auth state, allow rendering (even if user is null)
      // This is the source of truth for authentication
      if (hasIndexedDBAuth) {
        // IndexedDB says we're authenticated - never redirect
        console.log('[DashboardLayout] IndexedDB has auth state - allowing access');
        return;
      }
      
      // CRITICAL: If we're on a dashboard route and offline, NEVER redirect
      // This prevents redirects when going offline on any note/page
      if (isOnDashboardRoute && isOffline) {
        console.log('[DashboardLayout] Offline on dashboard route - preventing redirect');
        return; // Never redirect when offline on dashboard route
      }
      
      // Only redirect if: IndexedDB is empty AND online AND no user
      if (!user && !isOffline && !hasIndexedDBAuth) {
        // Online, no user, no IndexedDB auth state - redirect to login
        console.log('[DashboardLayout] No auth state - redirecting to login');
        hasRedirectedRef.current = true;
        router.push('/login');
      } else if (!user && isOffline && !hasIndexedDBAuth && !isOnDashboardRoute) {
        // Offline, no user, no IndexedDB auth, and not on dashboard route - redirect to login
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

