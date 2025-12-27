import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './config';
import { clearAuthState } from '@/lib/utils/authState';

export const signUp = async (email: string, password: string) => {
  return await createUserWithEmailAndPassword(auth, email, password);
};

export const signIn = async (email: string, password: string) => {
  // Check if we're offline before attempting sign in
  if (typeof window !== 'undefined' && !navigator.onLine) {
    throw new Error('Cannot sign in while offline. Please check your internet connection and try again.');
  }
  return await signInWithEmailAndPassword(auth, email, password);
};

export const logOut = async () => {
  // Clear IndexedDB auth state first (source of truth)
  await clearAuthState();
  
  // Clear localStorage cache
  if (typeof window !== 'undefined') {
    localStorage.removeItem('cached_user_id');
    localStorage.removeItem('cached_user_email');
    // Clear sessionStorage auth flag (allows redirects again on next session)
    sessionStorage.removeItem('dashboard_auth_established');
  }
  
  // Then sign out from Firebase
  return await signOut(auth);
};

export const getCurrentUser = (): Promise<FirebaseUser | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

