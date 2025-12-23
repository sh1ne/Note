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
  // Also show non-staple tabs (regular notes) - they should appear before staple tabs
  const stapleTabs = tabs.filter((tab) => tab.isStaple);
  const regularTabs = tabs.filter((tab) => !tab.isStaple);
  
  // Sort: regular tabs first (order 0), then staple tabs
  const sortedRegularTabs = [...regularTabs].sort((a, b) => a.order - b.order);
  const sortedStapleTabs = [...stapleTabs].sort((a, b) => a.order - b.order);
  const sortedTabs = [...sortedRegularTabs, ...sortedStapleTabs];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-50">
      <div className="flex items-center justify-around h-16 px-2">
        <button
          onClick={onCreateNote}
          className="flex flex-col items-center justify-center w-12 h-12 text-white hover:bg-gray-800 rounded"
          title="Create note"
          aria-label="Create new note"
        >
          <span className="text-2xl">+</span>
        </button>
        {sortedTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 h-12 text-white hover:bg-gray-800 rounded ${
              activeTabId === tab.id ? 'bg-gray-800' : ''
            }`}
          >
            <span className="text-lg mb-1">{tab.icon}</span>
            <span className="text-xs">{tab.name}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

