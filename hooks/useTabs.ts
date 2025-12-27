import { useState, useEffect, useCallback, useRef } from 'react';
import { Tab } from '@/lib/types';
import { getTabs } from '@/lib/firebase/firestore';

interface UseTabsOptions {
  notebookId: string;
  defaultTabName?: string;
}

// Staple tabs that should always exist
const STAPLE_TABS: Omit<Tab, 'id' | 'notebookId'>[] = [
  { name: 'Scratch', icon: '📝', order: 0, isStaple: true, isLocked: false, createdAt: new Date() },
  { name: 'Now', icon: '⚡', order: 1, isStaple: true, isLocked: false, createdAt: new Date() },
  { name: 'Short-Term', icon: '📅', order: 2, isStaple: true, isLocked: false, createdAt: new Date() },
  { name: 'Long-term', icon: '🗓️', order: 3, isStaple: true, isLocked: false, createdAt: new Date() },
];

export function useTabs({ notebookId, defaultTabName = 'Scratch' }: UseTabsOptions) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const hasSetDefault = useRef(false);

  // Separate loading function that doesn't depend on activeTabId
  const loadTabs = useCallback(async () => {
    if (!notebookId) return;
    
    const isOffline = typeof window !== 'undefined' && !navigator.onLine;
    
    try {
      let tabsData: Tab[] = [];
      
      if (isOffline) {
        // When offline, create staple tabs from known structure
        // These tabs should always exist for staple notes
        tabsData = STAPLE_TABS.map((stapleTab, index) => ({
          ...stapleTab,
          id: `staple-${stapleTab.name.toLowerCase().replace(/\s+/g, '-')}`,
          notebookId,
        })) as Tab[];
        
        // Add "All Notes" and "More" tabs for offline
        tabsData.push(
          {
            id: `staple-all-notes`,
            notebookId,
            name: 'All Notes',
            icon: '📋',
            order: 5,
            isStaple: true,
            isLocked: true,
            createdAt: new Date(),
          },
          {
            id: `staple-more`,
            notebookId,
            name: 'More',
            icon: '⋯',
            order: 6,
            isStaple: true,
            isLocked: true,
            createdAt: new Date(),
          }
        );
        
        console.log('[useTabs] Offline: Using staple tabs fallback', tabsData.length);
      } else {
        // Online: load from Firestore
        tabsData = await getTabs(notebookId);
      }
      
      setTabs(tabsData);
      
      // Set default tab only once on initial load
      if (tabsData.length > 0 && !hasSetDefault.current) {
        const defaultTab = tabsData.find((t) => t.name === defaultTabName) || tabsData[0];
        setActiveTabId(defaultTab.id);
        hasSetDefault.current = true;
      }
    } catch (error) {
      console.error('Error loading tabs:', error);
      
      // Fallback to staple tabs on error (especially when offline)
      if (isOffline) {
        const fallbackTabs = STAPLE_TABS.map((stapleTab) => ({
          ...stapleTab,
          id: `staple-${stapleTab.name.toLowerCase().replace(/\s+/g, '-')}`,
          notebookId,
        })) as Tab[];
        
        // Add "All Notes" and "More" tabs for offline fallback
        fallbackTabs.push(
          {
            id: `staple-all-notes`,
            notebookId,
            name: 'All Notes',
            icon: '📋',
            order: 5,
            isStaple: true,
            isLocked: true,
            createdAt: new Date(),
          },
          {
            id: `staple-more`,
            notebookId,
            name: 'More',
            icon: '⋯',
            order: 6,
            isStaple: true,
            isLocked: true,
            createdAt: new Date(),
          }
        );
        
        setTabs(fallbackTabs);
        
        if (fallbackTabs.length > 0 && !hasSetDefault.current) {
          const defaultTab = fallbackTabs.find((t) => t.name === defaultTabName) || fallbackTabs[0];
          setActiveTabId(defaultTab.id);
          hasSetDefault.current = true;
        }
      }
    } finally {
      setLoading(false);
    }
  }, [notebookId, defaultTabName]);

  useEffect(() => {
    loadTabs();
  }, [loadTabs]);

  // Memoized helper functions
  const getTabById = useCallback((tabId: string): Tab | undefined => {
    return tabs.find((t) => t.id === tabId);
  }, [tabs]);

  const getTabByName = useCallback((name: string): Tab | undefined => {
    return tabs.find((t) => t.name === name);
  }, [tabs]);

  const refreshTabs = useCallback(async () => {
    await loadTabs();
  }, [loadTabs]);

  return {
    tabs,
    activeTabId,
    loading,
    setActiveTabId,
    getTabById,
    getTabByName,
    refreshTabs,
  };
}
