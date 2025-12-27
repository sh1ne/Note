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
      // Check if we have a user OR if we're offline with cached user info
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      const cachedUserId = typeof window !== 'undefined' ? localStorage.getItem('cached_user_id') : null;
      const isOnDashboardRoute = pathname && pathname !== '/login' && pathname !== '/signup';
      
      // If we're on a dashboard route and offline with cached user, never redirect
      if (isOnDashboardRoute && isOffline && cachedUserId) {
        console.log('[DashboardLayout] Offline on dashboard route with cached user - preventing redirect');
        return;
      }
      
      if (!user && !isOffline) {
        // Online and no user - redirect to login
        hasRedirectedRef.current = true;
        router.push('/login');
      } else if (!user && isOffline && !cachedUserId) {
        // Offline and no user and no cache - redirect to login
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

