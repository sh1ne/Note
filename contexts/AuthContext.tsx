'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { getAuthState, saveAuthState, clearAuthState } from '@/lib/utils/authState';

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
  const isInitialMountRef = React.useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // STEP 1: Check IndexedDB FIRST (source of truth, works offline)
    const initializeFromIndexedDB = async () => {
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        
        try {
          const authState = await getAuthState();
          
          if (authState) {
            // We have auth state in IndexedDB - check if Firebase also has the user
            // This handles both online and offline scenarios
            if (auth.currentUser && auth.currentUser.uid === authState.userId) {
              // Firebase has the user and it matches IndexedDB - use it
              console.log('[Auth] Initial mount - found user in both IndexedDB and Firebase:', authState.userId);
              lastKnownUserRef.current = auth.currentUser;
              setUser(auth.currentUser);
              setLoading(false);
            } else if (!navigator.onLine) {
              // Offline and IndexedDB has state - create a minimal user object or use Firebase if available
              // For now, if Firebase has any user, use it (even if UID doesn't match, IndexedDB might be stale)
              if (auth.currentUser) {
                console.log('[Auth] Initial mount offline - using Firebase user (IndexedDB may be stale)');
                lastKnownUserRef.current = auth.currentUser;
                setUser(auth.currentUser);
                // Update IndexedDB with current Firebase user
                await saveAuthState(auth.currentUser.uid, auth.currentUser.email || '');
              } else {
                // Offline, IndexedDB has state, but no Firebase user
                // We'll allow the app to work with IndexedDB state (layout will check it)
                console.log('[Auth] Initial mount offline - IndexedDB has auth state, Firebase user not available');
                // Don't set user object, but set loading to false so layout can check IndexedDB
                setLoading(false);
              }
            } else {
              // Online but Firebase doesn't have user - IndexedDB state might be stale
              // Clear it and wait for Firebase to verify
              console.log('[Auth] Initial mount - IndexedDB has state but Firebase user not found, clearing stale state');
              await clearAuthState();
            }
          } else {
            // No auth state in IndexedDB - check for migration from localStorage
            const cachedUserId = typeof window !== 'undefined' ? localStorage.getItem('cached_user_id') : null;
            const cachedUserEmail = typeof window !== 'undefined' ? localStorage.getItem('cached_user_email') : null;
            
            if (cachedUserId && cachedUserEmail) {
              // Migrate from localStorage to IndexedDB
              console.log('[Auth] Migrating auth state from localStorage to IndexedDB:', cachedUserId);
              await saveAuthState(cachedUserId, cachedUserEmail);
            }
            
            // Check Firebase as fallback
            if (auth.currentUser) {
              console.log('[Auth] Initial mount - no IndexedDB state, but Firebase has user, saving to IndexedDB');
              lastKnownUserRef.current = auth.currentUser;
              setUser(auth.currentUser);
              await saveAuthState(auth.currentUser.uid, auth.currentUser.email || '');
              setLoading(false);
            } else if (cachedUserId) {
              // Have cached user ID but no Firebase user - might be offline
              // IndexedDB now has the migrated state, layout will check it
              console.log('[Auth] Initial mount - migrated localStorage to IndexedDB, Firebase user not available');
              setLoading(false);
            } else {
              // No auth state anywhere
              console.log('[Auth] Initial mount - no auth state found');
              setLoading(false);
            }
          }
        } catch (error) {
          console.error('[Auth] Error initializing from IndexedDB:', error);
          // Fallback to Firebase if IndexedDB fails
          if (auth.currentUser) {
            lastKnownUserRef.current = auth.currentUser;
            setUser(auth.currentUser);
            await saveAuthState(auth.currentUser.uid, auth.currentUser.email || '');
          }
          setLoading(false);
        }
      }
    };
    
    initializeFromIndexedDB();
    
    // STEP 2: Listen to Firebase Auth for verification (when online)
    // This updates IndexedDB when Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const isOffline = !navigator.onLine;
      
      if (firebaseUser) {
        // Firebase says user is authenticated
        // Update IndexedDB and state
        console.log('[Auth] Firebase auth state changed - user authenticated:', firebaseUser.uid);
        lastKnownUserRef.current = firebaseUser;
        setUser(firebaseUser);
        await saveAuthState(firebaseUser.uid, firebaseUser.email || '');
        setLoading(false);
      } else {
        // Firebase says user is null
        if (isOffline) {
          // OFFLINE: Ignore Firebase callback, trust IndexedDB
          // Check if IndexedDB has auth state
          const authState = await getAuthState();
          if (authState) {
            // IndexedDB says we're authenticated - trust it, ignore Firebase
            console.log('[Auth] Offline: Firebase says null but IndexedDB has auth state - trusting IndexedDB');
            // Keep last known user if we have it, or check auth.currentUser
            if (lastKnownUserRef.current) {
              setUser(lastKnownUserRef.current);
            } else if (auth.currentUser) {
              // Firebase persistence still has user even though callback says null
              console.log('[Auth] Offline: Using auth.currentUser despite callback saying null');
              lastKnownUserRef.current = auth.currentUser;
              setUser(auth.currentUser);
              await saveAuthState(auth.currentUser.uid, auth.currentUser.email || '');
            }
            // Don't clear state - IndexedDB is source of truth when offline
            setLoading(false);
            return;
          }
          // Offline, no IndexedDB state, no Firebase user - truly logged out
          console.log('[Auth] Offline: No auth state anywhere - user is logged out');
          setUser(null);
          setLoading(false);
        } else {
          // ONLINE: Firebase says user is logged out - clear IndexedDB and state
          console.log('[Auth] Online: Firebase says user logged out - clearing IndexedDB');
          await clearAuthState();
          lastKnownUserRef.current = null;
          setUser(null);
          setLoading(false);
        }
      }
    });

    // STEP 3: Listen for offline events to preserve state
    const handleOffline = async () => {
      if (auth.currentUser) {
        console.log('[Auth] Going offline - preserving current user state to IndexedDB');
        lastKnownUserRef.current = auth.currentUser;
        setUser(auth.currentUser);
        await saveAuthState(auth.currentUser.uid, auth.currentUser.email || '');
      } else if (lastKnownUserRef.current) {
        console.log('[Auth] Going offline - preserving last known user');
        setUser(lastKnownUserRef.current);
        await saveAuthState(lastKnownUserRef.current.uid, lastKnownUserRef.current.email || '');
      }
    };
    
    window.addEventListener('offline', handleOffline);

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

