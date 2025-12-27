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
    
    // On initial mount, if we're offline and have cached user, preserve current user
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      const isOffline = !navigator.onLine;
      const cachedUserId = localStorage.getItem('cached_user_id');
      if (isOffline && cachedUserId && auth.currentUser) {
        lastKnownUserRef.current = auth.currentUser;
        setUser(auth.currentUser);
        setLoading(false);
        console.log('[Auth] Initial mount offline - preserving current user from Firebase persistence');
      }
    }
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // User is authenticated - cache their info and update state
        localStorage.setItem('cached_user_id', firebaseUser.uid);
        localStorage.setItem('cached_user_email', firebaseUser.email || '');
        lastKnownUserRef.current = firebaseUser;
        setUser(firebaseUser);
      } else {
        // Firebase says user is null
        const isOffline = !navigator.onLine;
        const cachedUserId = localStorage.getItem('cached_user_id');
        
        if (isOffline && cachedUserId) {
          // Offline and we have cached user info
          if (lastKnownUserRef.current) {
            // Keep using last known user
            console.log('[Auth] Offline mode - preserving user session from cache');
            setUser(lastKnownUserRef.current);
          } else if (auth.currentUser) {
            // Firebase still has user in persistence, use it
            console.log('[Auth] Offline mode - using Firebase persisted user');
            lastKnownUserRef.current = auth.currentUser;
            setUser(auth.currentUser);
          } else {
            // No user object but have cached ID - don't set to null
            // Layout will check for cachedUserId
            console.log('[Auth] Offline mode - have cached user ID, keeping state');
            // Don't call setUser(null) - leave it as is
          }
        } else {
          // Online and no user - clear cache and set user to null
          localStorage.removeItem('cached_user_id');
          localStorage.removeItem('cached_user_email');
          lastKnownUserRef.current = null;
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

