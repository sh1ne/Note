'use client';

import { useState } from 'react';
import { Tab } from '@/lib/types';

interface BottomNavProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onCreateNote: () => void;
}

export default function BottomNav({
  tabs,
  activeTabId,
  onTabClick,
  onCreateNote,
}: BottomNavProps) {
  // Show staple tabs (Scratch, Now, etc.) and special tabs (All Notes, More)
  // Only show the active regular note tab (non-staple tabs) if it's currently active
  const stapleTabs = tabs.filter((tab) => tab.isStaple);
  const regularTabs = tabs.filter((tab) => !tab.isStaple);
  
  // Only show the active regular tab, not all regular tabs
  const activeRegularTab = regularTabs.find((tab) => tab.id === activeTabId);
  const regularTabsToShow = activeRegularTab ? [activeRegularTab] : [];
  
  // Sort: active regular tab first (if exists), then staple tabs
  const sortedStapleTabs = [...stapleTabs].sort((a, b) => a.order - b.order);
  const sortedTabs = [...regularTabsToShow, ...sortedStapleTabs];

  return (
    <nav className="fixed left-0 right-0 bg-bg-primary border-t border-bg-secondary z-50 rounded-t-2xl overflow-hidden" style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 48px)' }}>
      <div className="flex items-center justify-around h-14 px-2">
        <button
          onClick={onCreateNote}
          className="flex flex-col items-center justify-center w-12 h-12 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
          title="Create note"
          aria-label="Create new note"
        >
          <span className="text-2xl">+</span>
        </button>
        {sortedTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 h-12 text-text-primary hover:bg-bg-secondary rounded min-w-0 ${
              activeTabId === tab.id ? 'bg-bg-secondary' : ''
            }`}
          >
            <span className="text-lg shrink-0" style={{ lineHeight: '1.2' }}>{tab.icon}</span>
            <span className="text-[10px] leading-tight truncate w-full text-center px-0.5 mt-0.5" style={{ minHeight: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tab.name === 'Long-term' ? 'Long' : tab.name === 'Short-Term' ? 'Short' : tab.name}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

