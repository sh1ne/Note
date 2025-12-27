'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Initialize with cached user info if available and offline
  const getInitialUser = (): FirebaseUser | null => {
    if (typeof window === 'undefined') return null;
    const isOffline = !navigator.onLine;
    const cachedUserId = localStorage.getItem('cached_user_id');
    // If offline and have cached user, try to restore from auth state
    // (Firebase should have it in persistence, but we'll check)
    if (isOffline && cachedUserId) {
      // Return current auth user if available, otherwise null (layout will check cache)
      return auth.currentUser;
    }
    return null;
  };

  const [user, setUser] = useState<FirebaseUser | null>(getInitialUser());
  const [loading, setLoading] = useState(true);
  const lastKnownUserRef = React.useRef<FirebaseUser | null>(null);
  const isInitialMountRef = React.useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // On initial mount, check Firebase persistence directly
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      // Always check auth.currentUser on mount - Firebase persistence should have it
      if (auth.currentUser) {
        lastKnownUserRef.current = auth.currentUser;
        setUser(auth.currentUser);
        localStorage.setItem('cached_user_id', auth.currentUser.uid);
        localStorage.setItem('cached_user_email', auth.currentUser.email || '');
        console.log('[Auth] Initial mount - found user in Firebase persistence');
      }
    }
    
    // Listen for offline events to immediately preserve user state
    const handleOffline = () => {
      if (auth.currentUser) {
        console.log('[Auth] Going offline - preserving current user state');
        lastKnownUserRef.current = auth.currentUser;
        setUser(auth.currentUser);
        localStorage.setItem('cached_user_id', auth.currentUser.uid);
        localStorage.setItem('cached_user_email', auth.currentUser.email || '');
      } else if (lastKnownUserRef.current) {
        console.log('[Auth] Going offline - preserving last known user');
        setUser(lastKnownUserRef.current);
      }
    };
    
    window.addEventListener('offline', handleOffline);
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const isOffline = !navigator.onLine;
      
      if (firebaseUser) {
        // User is authenticated - cache their info and update state
        localStorage.setItem('cached_user_id', firebaseUser.uid);
        localStorage.setItem('cached_user_email', firebaseUser.email || '');
        lastKnownUserRef.current = firebaseUser;
        setUser(firebaseUser);
      } else {
        // onAuthStateChanged fired with null
        // CRITICAL: When offline, always check auth.currentUser directly
        // Firebase persistence may still have the user even if callback says null
        if (isOffline) {
          const cachedUserId = localStorage.getItem('cached_user_id');
          
          // Always check auth.currentUser when offline - it's the source of truth
          if (auth.currentUser) {
            // Firebase persistence still has the user - use it!
            console.log('[Auth] Offline: onAuthStateChanged(null) but auth.currentUser exists - using persisted user');
            lastKnownUserRef.current = auth.currentUser;
            setUser(auth.currentUser);
            // Update cache
            localStorage.setItem('cached_user_id', auth.currentUser.uid);
            localStorage.setItem('cached_user_email', auth.currentUser.email || '');
          } else if (lastKnownUserRef.current && cachedUserId) {
            // No currentUser but we have last known user - keep it
            console.log('[Auth] Offline: Using last known user from ref');
            setUser(lastKnownUserRef.current);
          } else if (cachedUserId) {
            // Have cached ID but no user object - don't clear, layout will handle
            console.log('[Auth] Offline: Have cached user ID, preserving state');
            // Don't set to null - keep previous state
          } else {
            // Offline, no cache, no user - truly logged out
            console.log('[Auth] Offline: No user, no cache - user is logged out');
            setUser(null);
          }
        } else {
          // Online and callback says null - user is truly logged out
          console.log('[Auth] Online: User logged out');
          localStorage.removeItem('cached_user_id');
          localStorage.removeItem('cached_user_email');
          lastKnownUserRef.current = null;
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

