import { getDB, AuthState } from './localStorage';

/**
 * Save authentication state to IndexedDB
 * This becomes the source of truth for authentication
 */
export const saveAuthState = async (userId: string, email: string, token?: string): Promise<void> => {
  try {
    const database = await getDB();
    const authState: AuthState = {
      id: 'current',
      userId,
      email,
      lastVerified: new Date(),
      token,
    };
    await database.put('auth', authState);
    console.log('[AuthState] Saved auth state to IndexedDB:', userId);
  } catch (error: any) {
    console.error('[AuthState] Failed to save auth state:', error);
    // Don't throw - allow app to continue even if IndexedDB fails
  }
};

/**
 * Get authentication state from IndexedDB
 * Returns null if no auth state exists
 */
export const getAuthState = async (): Promise<AuthState | null> => {
  try {
    const database = await getDB();
    const authState = await database.get('auth', 'current');
    return authState || null;
  } catch (error: any) {
    console.warn('[AuthState] Failed to get auth state from IndexedDB:', error?.message);
    return null;
  }
};

/**
 * Clear authentication state from IndexedDB
 * Only called on explicit logout
 */
export const clearAuthState = async (): Promise<void> => {
  try {
    const database = await getDB();
    await database.delete('auth', 'current');
    console.log('[AuthState] Cleared auth state from IndexedDB');
  } catch (error: any) {
    console.error('[AuthState] Failed to clear auth state:', error);
    // Don't throw - allow app to continue even if IndexedDB fails
  }
};

/**
 * Check if user is authenticated based on IndexedDB state
 * This is the source of truth for authentication status
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const authState = await getAuthState();
  return authState !== null;
};

