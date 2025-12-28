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
  
  // Sort staple tabs by order
  const sortedStapleTabs = [...stapleTabs].sort((a, b) => (a.order || 0) - (b.order || 0));
  
  // Combine: active regular tab first (if it exists), then staple tabs
  const sortedTabs = activeRegularTab 
    ? [activeRegularTab, ...sortedStapleTabs]
    : sortedStapleTabs;

  return (
    <>
      <style jsx>{`
        /* Force BottomNav to always use 16px base sizing, regardless of data-font-size */
        nav[data-bottom-nav] {
          font-size: 16px !important;
        }
        nav[data-bottom-nav] * {
          font-size: inherit;
        }
      `}</style>
      <nav 
        data-bottom-nav
        className="fixed left-0 right-0 bg-bg-primary border-t border-bg-secondary z-50 overflow-hidden" 
        style={{ 
          borderRadius: 0, 
          bottom: '-4px', 
          height: '80px',
          fontSize: '16px' // Isolate from data-font-size changes
        }}
      >
        <div 
          className="flex items-center justify-around" 
          style={{ 
            paddingBottom: 'env(safe-area-inset-bottom, 0px)', 
            height: '80px',
            paddingLeft: '16px',
            paddingRight: '16px',
            fontSize: '16px' // Isolate from data-font-size changes
          }}
        >
          <button
            onClick={onCreateNote}
            className="flex flex-col items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded transition-colors shrink-0"
            title="Create note"
            aria-label="Create new note"
            style={{ 
              fontSize: '16px', // Isolate from data-font-size changes
              width: '72px',
              height: '72px'
            }}
          >
            <span style={{ fontSize: '48px', lineHeight: 1 }}>+</span>
          </button>
          {sortedTabs.map((tab) => {
            const isStapleTab = tab.isStaple;
            const isRegularTab = !isStapleTab;
            return (
              <button
                key={tab.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const isOffline = typeof window !== 'undefined' && !navigator.onLine;
                  console.log('[BottomNav] Tab clicked:', tab.name, 'id:', tab.id, 'offline:', isOffline, 'timestamp:', new Date().toISOString());
                  console.trace('[BottomNav] Click stack trace');
                  onTabClick(tab.id);
                }}
                type="button"
                className={`flex flex-col items-center justify-center text-text-primary hover:bg-bg-secondary rounded flex-shrink-0 ${
                  activeTabId === tab.id ? 'bg-bg-secondary' : ''
                } ${isStapleTab ? 'flex-1' : 'flex-1'}`}
                style={{ 
                  minWidth: 0, 
                  fontSize: '16px', // Isolate from data-font-size changes
                  height: '72px'
                }}
              >
                <span style={{ fontSize: '32px', lineHeight: '1.2' }}>{tab.icon}</span>
              <span 
                className={`text-center ${isStapleTab ? 'truncate w-full' : ''}`}
                style={{ 
                  fontSize: '16px', // Fixed pixel size, not rem-based - larger to match pic2
                  minHeight: '18px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  paddingLeft: '8px',
                  paddingRight: '8px',
                  marginTop: '8px',
                  lineHeight: '1.1',
                  ...(isRegularTab ? { overflow: 'visible', whiteSpace: 'normal', wordBreak: 'break-word' } : {})
                }}
              >
                {tab.name === 'Long-term' ? 'Long' : tab.name === 'Short-Term' ? 'Short' : tab.name}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
    </>
  );
}

