'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getNotes, createNote, createTab } from '@/lib/firebase/firestore';
import { Note } from '@/lib/types';
import BottomNav from '@/components/layout/BottomNav';
import NoteList from '@/components/notes/NoteList';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import { useTabs } from '@/hooks/useTabs';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { isStapleNoteTab } from '@/lib/utils/noteHelpers';

export default function NotebookPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const notebookId = params.notebookId as string;

  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const hasHandledInitialLoad = useRef(false);

  // Use custom hooks
  const { tabs, activeTabId, setActiveTabId, getTabById, loading } = useTabs({ 
    notebookId,
    defaultTabName: 'Scratch'
  });

  const { navigateToTab } = useTabNavigation({
    notebookId,
    userId: user?.uid || '',
  });

  // Handle initial load - redirect staple tabs to their notes or show All Notes
  useEffect(() => {
    const handleInitialLoad = async () => {
      if (tabs.length > 0 && activeTabId && user && !hasHandledInitialLoad.current) {
        // Check URL for view param (for shareable links)
        const viewParam = searchParams.get('view');
        if (viewParam === 'all-notes') {
          const allNotesTab = tabs.find(t => t.name === 'All Notes');
          if (allNotesTab) {
            setActiveTabId(allNotesTab.id);
            await loadAllNotes();
            hasHandledInitialLoad.current = true;
            // Clean up URL after loading (optional - keeps URLs clean)
            router.replace(`/notebook/${notebookId}`);
            return;
          }
        }
        
        const activeTab = getTabById(activeTabId);
        if (activeTab && isStapleNoteTab(activeTab)) {
          // Redirect staple tabs to their notes on initial load
          await navigateToTab(activeTab);
          hasHandledInitialLoad.current = true;
        } else if (activeTab?.name === 'All Notes') {
          // Load all notes list on initial load
          await loadAllNotes();
          hasHandledInitialLoad.current = true;
        }
      }
    };
    handleInitialLoad();
  }, [tabs, activeTabId, user, getTabById, navigateToTab, searchParams, router, notebookId]);

  // Load notes when active tab changes (after initial load)
  useEffect(() => {
    if (hasHandledInitialLoad.current && activeTabId && notebookId && tabs.length > 0 && user) {
      const activeTab = getTabById(activeTabId);
      if (!activeTab) return;

      if (activeTab.name === 'All Notes') {
        loadAllNotes();
      } else if (!isStapleNoteTab(activeTab) && activeTab.name !== 'More') {
        // Load notes for regular tabs
        loadNotesForTab(activeTabId);
      }
    }
  }, [activeTabId, notebookId, tabs, user, getTabById]);

  const loadNotesForTab = async (tabId: string) => {
    if (!user || !notebookId) return;
    try {
      setError(null);
      const notesData = await getNotes(notebookId, tabId, user.uid);
      setNotes(notesData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notes';
      console.error('Error loading notes:', err);
      setError(errorMessage);
    }
  };

  const loadAllNotes = async () => {
    if (!user || !notebookId) return;
    try {
      setError(null);
      const notesData = await getNotes(notebookId, undefined, user.uid);
      const regularNotes = notesData.filter((n) => n && n.tabId !== 'staple' && !n.deletedAt);
      setNotes(regularNotes);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notes';
      console.error('Error loading all notes:', err);
      setError(errorMessage);
    }
  };

  const handleCreateNote = async () => {
    if (!user || !notebookId) return;

    try {
      const newTabId = await createTab({
        notebookId,
        name: 'New Note',
        icon: '📄',
        order: 0,
        isLocked: false,
        isStaple: false,
        createdAt: new Date(),
      });

      const noteId = await createNote({
        userId: user.uid,
        notebookId,
        tabId: newTabId,
        title: '',
        content: '',
        contentPlain: '',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isArchived: false,
        deletedAt: null,
      });

      router.push(`/notebook/${notebookId}/note/${noteId}`);
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const handleTabClick = async (tabId: string) => {
    const tab = getTabById(tabId);
    if (!tab) return;

    // Mark that we've handled initial load (user is now interacting)
    if (!hasHandledInitialLoad.current) {
      hasHandledInitialLoad.current = true;
    }

    setActiveTabId(tabId);

    // Use unified navigation
    const result = await navigateToTab(tab);

    // If navigation redirected, we're done
    if (result === 'redirect') {
      return;
    }

    // Handle staying on page or loading list
    if (result === 'load-list' || tab.name === 'All Notes') {
      // "All Notes" - load the list
      setNotes([]); // Clear to show loading state
      await loadAllNotes();
    } else if (!isStapleNoteTab(tab) && tab.name !== 'More') {
      // Regular tab - load notes for that tab
      await loadNotesForTab(tabId);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading notebook..." />;
  }

  if (error) {
    return (
      <ErrorMessage
        message={error}
        onRetry={() => {
          const activeTab = getTabById(activeTabId);
          if (activeTab?.name === 'All Notes') {
            loadAllNotes();
          } else {
            loadNotesForTab(activeTabId);
          }
        }}
      />
    );
  }

  const activeTab = getTabById(activeTabId);
  const isAllNotesTab = activeTab?.name === 'All Notes';
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pb-16">
      {/* Header Bar for All Notes */}
      {isAllNotesTab && (
        <div className="sticky top-0 bg-bg-primary border-b border-bg-secondary z-20">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="text-text-primary hover:text-text-secondary transition-colors"
                title="Back"
                aria-label="Back"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <button
                onClick={() => {
                  // Undo/redo not applicable for note list
                }}
                disabled
                className="text-text-secondary transition-colors disabled:opacity-30"
                title="Undo"
                aria-label="Undo"
              >
                ↶
              </button>
              <button
                onClick={() => {
                  // Undo/redo not applicable for note list
                }}
                disabled
                className="text-text-secondary transition-colors disabled:opacity-30"
                title="Redo"
                aria-label="Redo"
              >
                ↷
              </button>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (showSearch) {
                    setSearchQuery('');
                  }
                }}
                className="text-text-primary hover:text-text-secondary transition-colors"
                title="Search"
                aria-label="Search"
              >
                🔍
              </button>
            </div>
          </div>
          {showSearch && (
            <div className="px-4 pb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full px-3 py-2 bg-bg-secondary border border-text-secondary rounded text-text-primary focus:outline-none focus:border-text-primary"
                autoFocus
              />
            </div>
          )}
        </div>
      )}
      <div className="container mx-auto p-4">
        {activeTab && !isAllNotesTab && (
          <h1 className="text-2xl font-bold mb-4">{activeTab.name}</h1>
        )}
        {notes.length === 0 && !isAllNotesTab ? (
          <p className="text-text-secondary">No notes yet. Create one with the + button.</p>
        ) : (
          <NoteList
            notes={searchQuery ? notes.filter(note => 
              (note.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              (note.contentPlain || '').toLowerCase().includes(searchQuery.toLowerCase())
            ) : notes}
            notebookId={notebookId}
            onNoteClick={(noteId) => {
              router.push(`/notebook/${notebookId}/note/${noteId}`);
            }}
            onNoteDeleted={() => {
              if (isAllNotesTab) {
                loadAllNotes();
              } else {
                loadNotesForTab(activeTabId);
              }
            }}
          />
        )}
      </div>
      <BottomNav
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={handleTabClick}
        onCreateNote={handleCreateNote}
      />
    </div>
  );
}

