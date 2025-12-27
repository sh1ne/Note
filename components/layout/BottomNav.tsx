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
  // Only show staple tabs (Scratch, Now, etc.) and special tabs (All Notes, More)
  // Additionally, show the currently active tab if it's a regular note tab (only while viewing that note)
  const stapleTabs = tabs.filter((tab) => tab.isStaple);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const activeRegularTab = activeTab && !activeTab.isStaple ? activeTab : null;
  
  // Combine staple tabs with the active regular tab (if it exists)
  const tabsToShow = activeRegularTab 
    ? [...stapleTabs, activeRegularTab]
    : stapleTabs;
  
  // Sort by order (staple tabs have order, regular tabs have order 0)
  const sortedTabs = [...tabsToShow].sort((a, b) => {
    // Staple tabs first (they have higher order values), then regular tabs
    if (a.isStaple && !b.isStaple) return -1;
    if (!a.isStaple && b.isStaple) return 1;
    // Within same type, sort by order
    return (a.order || 0) - (b.order || 0);
  });

  return (
    <nav className="fixed left-0 right-0 bg-bg-primary border-t border-bg-secondary z-50 overflow-hidden" style={{ borderRadius: 0, bottom: '-4px' }}>
      <div className="flex items-center justify-around h-14 px-1" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <button
          onClick={onCreateNote}
          className="flex flex-col items-center justify-center w-12 h-12 bg-green-600 hover:bg-green-700 text-white rounded transition-colors shrink-0"
          title="Create note"
          aria-label="Create new note"
        >
          <span className="text-3xl leading-none">+</span>
        </button>
        {sortedTabs.map((tab) => {
          const isStapleTab = tab.isStaple;
          const isRegularTab = !isStapleTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              className={`flex flex-col items-center justify-center h-12 text-text-primary hover:bg-bg-secondary rounded min-w-0 ${
                activeTabId === tab.id ? 'bg-bg-secondary' : ''
              } ${isStapleTab ? 'flex-1' : 'flex-1 min-w-0'}`}
            >
              <span className="text-lg shrink-0" style={{ lineHeight: '1.2' }}>{tab.icon}</span>
              <span 
                className={`leading-tight text-center px-0.5 mt-0.5 ${isStapleTab ? 'text-[10px] truncate w-full' : 'text-[10px]'}`}
                style={{ 
                  minHeight: '12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  ...(isRegularTab ? { overflow: 'visible', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.1' } : {})
                }}
              >
                {tab.name === 'Long-term' ? 'Long' : tab.name === 'Short-Term' ? 'Short' : tab.name}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

