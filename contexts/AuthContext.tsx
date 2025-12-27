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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const lastKnownUserRef = React.useRef<FirebaseUser | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Try to restore user from localStorage if Firebase hasn't loaded yet
    const cachedUserId = localStorage.getItem('cached_user_id');
    const cachedUserEmail = localStorage.getItem('cached_user_email');
    
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
        
        if (isOffline && cachedUserId && lastKnownUserRef.current) {
          // Offline and we have cached user info - keep using last known user
          // Firebase Auth sometimes clears user state when offline, but we know the user is still authenticated
          console.log('[Auth] Offline mode - preserving user session from cache');
          // Keep the last known user instead of setting to null
          setUser(lastKnownUserRef.current);
        } else if (isOffline && cachedUserId) {
          // Offline with cached ID but no last known user object
          // This can happen if the page reloads while offline
          // We'll still allow access by not setting user to null
          // The layout will check for cachedUserId
          console.log('[Auth] Offline mode - have cached user ID but no user object');
          // Don't set to null - keep the last known user if we have it
          if (lastKnownUserRef.current) {
            setUser(lastKnownUserRef.current);
          }
          // If no last known user, leave state as is (might be null, but layout will check cache)
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

