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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Try to restore user from localStorage if Firebase hasn't loaded yet
    const cachedUserId = localStorage.getItem('cached_user_id');
    const cachedUserEmail = localStorage.getItem('cached_user_email');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is authenticated - cache their info
        localStorage.setItem('cached_user_id', user.uid);
        localStorage.setItem('cached_user_email', user.email || '');
        setUser(user);
      } else {
        // User is not authenticated
        // If we're offline and have cached user info, keep the user state
        // (Firebase Auth might clear user when offline)
        const isOffline = !navigator.onLine;
        if (isOffline && cachedUserId) {
          // Create a minimal user object to keep the app working offline
          // This is a fallback - Firebase should handle this, but sometimes doesn't
          console.log('[Auth] Offline mode - using cached user info');
          // Don't set user to null - keep previous user state if available
          // The user object should persist from before going offline
        } else {
          // Online and no user - clear cache and set user to null
          localStorage.removeItem('cached_user_id');
          localStorage.removeItem('cached_user_email');
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

