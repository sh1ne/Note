import { useState, useEffect, useCallback, useRef } from 'react';
import { Tab } from '@/lib/types';
import { getTabs } from '@/lib/firebase/firestore';

interface UseTabsOptions {
  notebookId: string;
  defaultTabName?: string;
}

export function useTabs({ notebookId, defaultTabName = 'Scratch' }: UseTabsOptions) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const hasSetDefault = useRef(false);

  // Separate loading function that doesn't depend on activeTabId
  const loadTabs = useCallback(async () => {
    if (!notebookId) return;
    try {
      const tabsData = await getTabs(notebookId);
      setTabs(tabsData);
      
      // Set default tab only once on initial load
      if (tabsData.length > 0 && !hasSetDefault.current) {
        const defaultTab = tabsData.find((t) => t.name === defaultTabName) || tabsData[0];
        setActiveTabId(defaultTab.id);
        hasSetDefault.current = true;
      }
    } catch (error) {
      console.error('Error loading tabs:', error);
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
