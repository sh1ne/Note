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
    <nav className="fixed left-0 right-0 bg-bg-primary border-t border-bg-secondary z-50 overflow-hidden" style={{ borderRadius: 0, bottom: '-4px' }}>
      <div className="flex items-center justify-around h-14 px-1" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <button
          onClick={onCreateNote}
          className="flex flex-col items-center justify-center w-12 h-12 bg-green-600 hover:bg-green-700 text-white rounded transition-colors shrink-0"
          title="Create note"
          aria-label="Create new note"
        >
          <span className="text-2xl">+</span>
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

