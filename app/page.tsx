'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { traceLoginNav } from '@/lib/utils/loginNavTrace';
import { isAuthenticated } from '@/lib/utils/authState';

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // CRITICAL FIX: If we're on a dashboard/auth route, don't render anything
  // The dashboard layout will handle it
  if (pathname && pathname !== '/' && (pathname.startsWith('/base/') || pathname.startsWith('/notebook') || pathname.startsWith('/login'))) {
    console.log('[HomePage] Already on dashboard/auth route, returning null:', pathname);
    return null;
  }

  useEffect(() => {
    
    // CRITICAL FIX: Don't redirect if we're offline and have IndexedDB auth
    // This prevents redirects when service worker returns root HTML for uncached routes
    const checkAuthAndRedirect = async () => {
      if (loading) return;
      
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      
      // If offline, check IndexedDB auth state first
      if (isOffline && !user) {
        try {
          const hasAuth = await isAuthenticated();
          if (hasAuth) {
            // IndexedDB has auth - redirect to notebook instead of login
            console.log('[HomePage] Offline: IndexedDB has auth, redirecting to notebook');
            router.push('/notebook');
            return;
          }
        } catch (error) {
          console.error('[HomePage] Error checking IndexedDB auth:', error);
        }
      }
      
      // Normal flow: redirect based on user state
      if (user) {
        router.push('/notebook');
      } else {
        traceLoginNav('HomePage_no_user');
        router.push('/login');
      }
    };
    
    checkAuthAndRedirect();
  }, [user, loading, router, pathname]);

  return <LoadingSpinner message="Loading..." />;
}
