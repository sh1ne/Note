'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      // Check if we're offline and have cached user info
      // Don't redirect to login if we're offline - user might still be authenticated
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      const cachedUserId = typeof window !== 'undefined' ? localStorage.getItem('cached_user_id') : null;
      
      if (isOffline && cachedUserId) {
        // Offline with cached user - don't redirect, allow app to work offline
        console.log('[DashboardLayout] Offline mode - keeping user session with cached ID');
        return;
      }
      
      // Online or no cached user - redirect to login
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (typeof window !== 'undefined' && !user && !loading) {
    return null;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

