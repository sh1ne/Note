'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme } from '@/lib/types';
import { useAuth } from './AuthContext';
import { getUserPreferences, updateUserPreferences } from '@/lib/firebase/firestore';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  // Initialize with 'dark' to prevent hydration mismatch
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Load theme from Firestore (or localStorage as fallback)
  useEffect(() => {
    setMounted(true);
    const loadTheme = async () => {
      if (typeof window === 'undefined') return;
      
      // Try Firestore first if user is logged in
      if (user) {
        try {
          const prefs = await getUserPreferences(user.uid);
          if (prefs?.theme && ['dark', 'light', 'purple', 'blue'].includes(prefs.theme)) {
            setThemeState(prefs.theme);
            document.documentElement.setAttribute('data-theme', prefs.theme);
            setPreferencesLoaded(true);
            return;
          }
        } catch (error) {
          console.error('Error loading theme from Firestore:', error);
        }
      }
      
      // Fallback to localStorage
      const savedTheme = localStorage.getItem('theme') as Theme;
      if (savedTheme && ['dark', 'light', 'purple', 'blue'].includes(savedTheme)) {
        setThemeState(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      setPreferencesLoaded(true);
    };

    loadTheme();
  }, [user]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
      
      // Save to Firestore if user is logged in
      if (user) {
        try {
          await updateUserPreferences(user.uid, { theme: newTheme });
        } catch (error) {
          console.error('Error saving theme to Firestore:', error);
          // Fallback to localStorage
          localStorage.setItem('theme', newTheme);
        }
      } else {
        // Fallback to localStorage if not logged in
        localStorage.setItem('theme', newTheme);
      }
    }
  };

  // Update theme attribute when theme changes (after mount)
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

