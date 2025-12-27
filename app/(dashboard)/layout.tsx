'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { isAuthenticated } from '@/lib/utils/authState';
import { traceLoginNav } from '@/lib/utils/loginNavTrace';

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
  const mountIdRef = useRef<string>(`mount-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [hasIndexedDBAuth, setHasIndexedDBAuth] = useState<boolean | null>(null);
  
  // STRUCTURAL FIX: Check sessionStorage on mount (synchronous, persists across reloads)
  // This provides a synchronous gate that survives hard reloads
  const sessionAuthKey = 'dashboard_auth_established';
  const sessionAuthEstablished = typeof window !== 'undefined' 
    ? sessionStorage.getItem(sessionAuthKey) === 'true' 
    : false;
  
  // If sessionStorage says auth was established, disable redirects immediately (synchronously)
  if (sessionAuthEstablished && canRedirectRef.current) {
    canRedirectRef.current = false;
    console.log(`[AUTH_TRACE][DashboardLayout][SESSION_AUTH][route=${pathname}] SessionStorage indicates auth established - disabling redirects synchronously on mount`);
  }
  
  // INSTRUMENTATION: Log mount/remount
  useEffect(() => {
    const mountId = mountIdRef.current;
    const timestamp = new Date().toISOString();
    const isOnline = typeof window !== 'undefined' ? navigator.onLine : false;
    console.log(`[AUTH_TRACE][DashboardLayout][MOUNT][id=${mountId}][route=${pathname}][online=${isOnline}][canRedirect=${canRedirectRef.current}][hasIndexedDBAuth=${hasIndexedDBAuth}][authResolved=${authResolvedOnceRef.current}] Component mounted/remounted at ${timestamp}`);
    
    return () => {
      console.log(`[AUTH_TRACE][DashboardLayout][UNMOUNT][id=${mountId}][route=${pathname}] Component unmounting`);
    };
  }, [pathname]);

  // Check IndexedDB auth state ONCE per session (source of truth)
  // This runs on mount and when loading completes, but only checks once
  useEffect(() => {
    const timestamp = new Date().toISOString();
    const isOnline = typeof window !== 'undefined' ? navigator.onLine : false;
    
    // Only check if we haven't resolved auth yet
    if (authResolvedOnceRef.current) {
      console.log(`[AUTH_TRACE][DashboardLayout][AUTH_CHECK][route=${pathname}][online=${isOnline}][timestamp=${timestamp}] Auth already resolved, skipping check`);
      return; // Already resolved, don't re-check
    }

    console.log(`[AUTH_TRACE][DashboardLayout][AUTH_CHECK][route=${pathname}][online=${isOnline}][loading=${loading}][timestamp=${timestamp}] Starting auth check - authResolvedOnceRef=${authResolvedOnceRef.current}`);

    // Wait for AuthContext to finish loading before checking IndexedDB
    if (!loading) {
      const checkIndexedDBAuth = async () => {
        const checkStartTime = Date.now();
        const checkTimestamp = new Date().toISOString();
        console.log(`[AUTH_TRACE][DashboardLayout][AUTH_CHECK_START][route=${pathname}][online=${isOnline}][timestamp=${checkTimestamp}] Beginning async IndexedDB check`);
        
        try {
          const authenticated = await isAuthenticated();
          const checkEndTime = Date.now();
          const checkDuration = checkEndTime - checkStartTime;
          
          console.log(`[AUTH_TRACE][DashboardLayout][AUTH_CHECK_RESULT][route=${pathname}][online=${isOnline}][authenticated=${authenticated}][duration=${checkDuration}ms][timestamp=${checkTimestamp}] IndexedDB check completed`);
          
          setHasIndexedDBAuth(authenticated);
          
          const beforeAuthResolved = authResolvedOnceRef.current;
          const beforeCanRedirect = canRedirectRef.current;
          authResolvedOnceRef.current = true; // Mark as resolved
          
          // CRITICAL: Once auth is established, disable redirects permanently
          // This prevents any future redirects during navigation
          if (authenticated) {
            canRedirectRef.current = false;
            // STRUCTURAL FIX: Persist to sessionStorage (survives hard reloads)
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(sessionAuthKey, 'true');
              console.log(`[AUTH_TRACE][DashboardLayout][SESSION_AUTH_SAVED][route=${pathname}][online=${isOnline}][timestamp=${checkTimestamp}] Saved auth state to sessionStorage`);
            }
            console.log(`[AUTH_TRACE][DashboardLayout][CAN_REDIRECT_CHANGE][route=${pathname}][online=${isOnline}][before=${beforeCanRedirect}][after=${canRedirectRef.current}][timestamp=${checkTimestamp}] Auth established - redirects permanently disabled`);
          }
          
          console.log(`[AUTH_TRACE][DashboardLayout][AUTH_RESOLVED_CHANGE][route=${pathname}][online=${isOnline}][before=${beforeAuthResolved}][after=${authResolvedOnceRef.current}][timestamp=${checkTimestamp}] Auth resolved flag set`);
          console.log('[DashboardLayout] Checked IndexedDB auth state:', authenticated);
        } catch (error) {
          const checkEndTime = Date.now();
          const checkDuration = checkEndTime - checkStartTime;
          console.error(`[AUTH_TRACE][DashboardLayout][AUTH_CHECK_ERROR][route=${pathname}][online=${isOnline}][duration=${checkDuration}ms][timestamp=${checkTimestamp}] Error checking IndexedDB auth:`, error);
          setHasIndexedDBAuth(false);
          authResolvedOnceRef.current = true; // Mark as resolved even on error
          console.log(`[AUTH_TRACE][DashboardLayout][AUTH_RESOLVED_CHANGE][route=${pathname}][online=${isOnline}][after=${authResolvedOnceRef.current}][timestamp=${checkTimestamp}] Auth resolved flag set (error case)`);
        }
      };
      checkIndexedDBAuth();
    } else {
      console.log(`[AUTH_TRACE][DashboardLayout][AUTH_CHECK_DEFERRED][route=${pathname}][online=${isOnline}][loading=${loading}][timestamp=${timestamp}] Auth check deferred - waiting for loading to complete`);
    }
  }, [loading, pathname]);

  useEffect(() => {
    const timestamp = new Date().toISOString();
    const isOffline = typeof window !== 'undefined' && !navigator.onLine;
    const isOnDashboardRoute = pathname && pathname !== '/login' && pathname !== '/signup' && pathname !== '/';
    
    console.log(`[AUTH_TRACE][DashboardLayout][REDIRECT_EFFECT][route=${pathname}][online=${!isOffline}][canRedirect=${canRedirectRef.current}][hasIndexedDBAuth=${hasIndexedDBAuth}][user=${user ? 'exists' : 'null'}][loading=${loading}][hasRedirected=${hasRedirectedRef.current}][authResolved=${authResolvedOnceRef.current}][timestamp=${timestamp}] Redirect effect fired`);
    
    // CRITICAL: If redirects are disabled (auth was established), NEVER redirect
    // This is the permanent gate that prevents redirects after auth is trusted
    if (!canRedirectRef.current) {
      console.log(`[AUTH_TRACE][DashboardLayout][REDIRECT_BLOCKED][route=${pathname}][online=${!isOffline}][reason=canRedirectRef_false][timestamp=${timestamp}] Redirect blocked - canRedirectRef is false`);
      return; // Redirects permanently disabled - auth was established
    }

    // CRITICAL: Never redirect if we're still checking IndexedDB auth state
    // This prevents race conditions during initial load
    if (hasIndexedDBAuth === null) {
      console.log(`[AUTH_TRACE][DashboardLayout][REDIRECT_BLOCKED][route=${pathname}][online=${!isOffline}][reason=hasIndexedDBAuth_null][timestamp=${timestamp}] Redirect blocked - still checking IndexedDB auth`);
      return; // Still checking, don't redirect yet
    }
    
    // CRITICAL: Never redirect if we've already redirected once
    if (hasRedirectedRef.current) {
      console.log(`[AUTH_TRACE][DashboardLayout][REDIRECT_BLOCKED][route=${pathname}][online=${!isOffline}][reason=already_redirected][timestamp=${timestamp}] Redirect blocked - already redirected once`);
      return;
    }
    
    if (!loading) {
      // CRITICAL: If IndexedDB has auth state, allow rendering and disable redirects permanently
      // This is the source of truth for authentication
      if (hasIndexedDBAuth) {
        // IndexedDB says we're authenticated - disable redirects permanently
        const beforeCanRedirect = canRedirectRef.current;
        canRedirectRef.current = false;
        // STRUCTURAL FIX: Persist to sessionStorage (survives hard reloads)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(sessionAuthKey, 'true');
          console.log(`[AUTH_TRACE][DashboardLayout][SESSION_AUTH_SAVED][route=${pathname}][online=${!isOffline}][timestamp=${timestamp}] Saved auth state to sessionStorage (from redirect effect)`);
        }
        console.log(`[AUTH_TRACE][DashboardLayout][CAN_REDIRECT_CHANGE][route=${pathname}][online=${!isOffline}][before=${beforeCanRedirect}][after=${canRedirectRef.current}][reason=hasIndexedDBAuth_true][timestamp=${timestamp}] Disabling redirects - IndexedDB has auth`);
        console.log('[DashboardLayout] IndexedDB has auth state - redirects permanently disabled');
        return;
      }
      
      // CRITICAL: If we're on a dashboard route, NEVER redirect
      // This prevents redirects during navigation between notes
      if (isOnDashboardRoute) {
        console.log(`[AUTH_TRACE][DashboardLayout][REDIRECT_BLOCKED][route=${pathname}][online=${!isOffline}][reason=on_dashboard_route][timestamp=${timestamp}] Redirect blocked - on dashboard route`);
        console.log('[DashboardLayout] On dashboard route - preventing redirect');
        return; // Never redirect when on dashboard route
      }
      
      // Only redirect if: IndexedDB is empty AND online AND no user AND not on dashboard route
      // AND redirects are still enabled (auth not yet established)
      if (!user && !isOffline && !hasIndexedDBAuth && canRedirectRef.current) {
        // Online, no user, no IndexedDB auth state, not on dashboard - redirect to login
        console.log(`[AUTH_TRACE][DashboardLayout][REDIRECT_TRIGGERED][route=${pathname}][online=${!isOffline}][reason=no_auth_online][timestamp=${timestamp}] ⚠️ REDIRECTING TO LOGIN`);
        console.log('[DashboardLayout] No auth state - redirecting to login');
        traceLoginNav('DashboardLayout_online_no_auth');
        hasRedirectedRef.current = true;
        router.push('/login');
      } else if (!user && isOffline && !hasIndexedDBAuth && canRedirectRef.current) {
        // Offline, no user, no IndexedDB auth, not on dashboard route - redirect to login
        console.log(`[AUTH_TRACE][DashboardLayout][REDIRECT_TRIGGERED][route=${pathname}][online=${!isOffline}][reason=no_auth_offline][timestamp=${timestamp}] ⚠️ REDIRECTING TO LOGIN`);
        console.log('[DashboardLayout] Offline, no auth state, not on dashboard - redirecting to login');
        traceLoginNav('DashboardLayout_offline_no_auth');
        hasRedirectedRef.current = true;
        router.push('/login');
      } else {
        console.log(`[AUTH_TRACE][DashboardLayout][REDIRECT_NOT_TRIGGERED][route=${pathname}][online=${!isOffline}][user=${user ? 'exists' : 'null'}][isOffline=${isOffline}][hasIndexedDBAuth=${hasIndexedDBAuth}][canRedirect=${canRedirectRef.current}][timestamp=${timestamp}] Redirect conditions not met`);
      }
    } else {
      console.log(`[AUTH_TRACE][DashboardLayout][REDIRECT_DEFERRED][route=${pathname}][online=${!isOffline}][loading=${loading}][timestamp=${timestamp}] Redirect check deferred - still loading`);
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

