'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (!loading && !hasRedirectedRef.current) {
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      const cachedUserId = typeof window !== 'undefined' ? localStorage.getItem('cached_user_id') : null;
      const isOnDashboardRoute = pathname && pathname !== '/login' && pathname !== '/signup' && pathname !== '/';
      
      // CRITICAL: If we're on a dashboard route and offline, NEVER redirect
      // This prevents redirects when going offline on any note/page
      if (isOnDashboardRoute && isOffline) {
        if (cachedUserId) {
          console.log('[DashboardLayout] Offline on dashboard route with cached user - preventing redirect');
        } else {
          console.log('[DashboardLayout] Offline on dashboard route - preventing redirect (no cache but staying on page)');
        }
        return; // Never redirect when offline on dashboard route
      }
      
      // Only redirect if online and no user, or offline with no cache and not on dashboard route
      if (!user && !isOffline) {
        // Online and no user - redirect to login
        hasRedirectedRef.current = true;
        router.push('/login');
      } else if (!user && isOffline && !cachedUserId && !isOnDashboardRoute) {
        // Offline, no user, no cache, and not on dashboard route - redirect to login
        hasRedirectedRef.current = true;
        router.push('/login');
      } else if (!user && isOffline && cachedUserId) {
        // Offline with cached user - don't redirect, allow app to work offline
        console.log('[DashboardLayout] Offline mode - keeping user session with cached ID:', cachedUserId);
      }
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  // Allow rendering if we have a user OR if we're offline with cached user info
  const isOffline = typeof window !== 'undefined' && !navigator.onLine;
  const cachedUserId = typeof window !== 'undefined' ? localStorage.getItem('cached_user_id') : null;
  const shouldRender = user || (isOffline && cachedUserId);

  if (!shouldRender) {
    return null;
  }

  return <>{children}</>;
}

