'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getNotes, createNote, createTab, getNotebookBySlug } from '@/lib/firebase/firestore';
import { saveNoteLocally, getAllNotesLocally, addToSyncQueue } from '@/lib/utils/localStorage';
import { Note } from '@/lib/types';
import BottomNav from '@/components/layout/BottomNav';
import NoteList from '@/components/notes/NoteList';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import { useTabs } from '@/hooks/useTabs';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { isStapleNoteTab, generateUniqueNoteTitle } from '@/lib/utils/noteHelpers';
import { createSlug } from '@/lib/utils/slug';

export default function NotebookPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useAuth();
  const notebookSlug = params.notebookSlug as string;
  
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const hasHandledInitialLoad = useRef(false);

  // Handle search including staple notes
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery || !notebookId || !user) {
        setSearchResults([]);
        return;
      }

      try {
        // Get all notes including staple notes for search
        const allNotes = await getNotes(notebookId, undefined, user.uid);
        const query = searchQuery.toLowerCase();
        // Only search note content, not titles
        const results = allNotes.filter(n => 
          n && !n.deletedAt && 
          (n.contentPlain || '').toLowerCase().includes(query)
        );
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching notes:', error);
        setSearchResults([]);
      }
    };

    performSearch();
  }, [searchQuery, notebookId, user]);

  // Look up notebook by slug
  useEffect(() => {
    const loadNotebook = async () => {
      if (!user || !notebookSlug) return;
      
      try {
        const notebook = await getNotebookBySlug(user.uid, notebookSlug);
        if (!notebook) {
          // If offline, try cache directly as fallback
          const isOffline = typeof window !== 'undefined' && !navigator.onLine;
          if (isOffline) {
            try {
              const { getNotebookBySlugLocally } = await import('@/lib/utils/localStorage');
              const cachedNotebook = await getNotebookBySlugLocally(user.uid, notebookSlug);
              if (cachedNotebook) {
                setNotebookId(cachedNotebook.id);
                setError(null);
                return;
              }
            } catch (cacheError) {
              console.error('Error loading notebook from cache:', cacheError);
            }
          }
          setError('Notebook not found');
          return;
        }
        setNotebookId(notebook.id);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load notebook';
        console.error('Error loading notebook:', err);
        
        // If offline, try cache as fallback
        const isOffline = typeof window !== 'undefined' && !navigator.onLine;
        if (isOffline) {
          try {
            const { getNotebookBySlugLocally } = await import('@/lib/utils/localStorage');
            const cachedNotebook = await getNotebookBySlugLocally(user.uid, notebookSlug);
            if (cachedNotebook) {
              setNotebookId(cachedNotebook.id);
              setError(null);
              return;
            }
          } catch (cacheError) {
            console.error('Error loading notebook from cache fallback:', cacheError);
          }
        }
        
        setError(errorMessage);
      }
    };
    
    loadNotebook();
  }, [user, notebookSlug]);

  // Use custom hooks (only after notebookId is loaded)
  const { tabs, activeTabId, setActiveTabId, getTabById, loading, refreshTabs } = useTabs({ 
    notebookId: notebookId || '',
    defaultTabName: 'Scratch'
  });

  const { navigateToTab } = useTabNavigation({
    notebookId: notebookId || '',
    notebookSlug: notebookSlug,
    userId: user?.uid || '',
  });

  // Handle initial load - redirect staple tabs to their notes or show All Notes
  useEffect(() => {
    const handleInitialLoad = async () => {
      if (tabs.length > 0 && activeTabId && user && notebookId && !hasHandledInitialLoad.current) {
        // Check URL for view param (for shareable links)
        const viewParam = searchParams.get('view');
        if (viewParam === 'all-notes') {
          const allNotesTab = tabs.find(t => t.name === 'All Notes');
          if (allNotesTab) {
            setActiveTabId(allNotesTab.id);
            await loadAllNotes();
            hasHandledInitialLoad.current = true;
            // Clean up URL after loading (optional - keeps URLs clean)
            router.replace(`/${notebookSlug}`);
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
  }, [tabs, activeTabId, user, notebookId, getTabById, navigateToTab, searchParams, router, notebookSlug]);

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
      
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      
      let notesData: Note[];
      if (isOffline) {
        // Load from local cache when offline
        const allLocalNotes = await getAllNotesLocally();
        notesData = allLocalNotes.filter(
          (n) => n.notebookId === notebookId && n.tabId === tabId && n.userId === user.uid
        );
      } else {
        notesData = await getNotes(notebookId, tabId, user.uid);
      }
      
      setNotes(notesData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notes';
      console.error('Error loading notes:', err);
      
      // If offline, try to load from local cache as fallback
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        try {
          const allLocalNotes = await getAllNotesLocally();
          const notesData = allLocalNotes.filter(
            (n) => n.notebookId === notebookId && n.tabId === tabId && n.userId === user.uid
          );
          setNotes(notesData);
          setError(null); // Clear error since we loaded from cache
        } catch (cacheErr) {
          setError('Unable to load notes. Please check your connection.');
        }
      } else {
      setError(errorMessage);
      }
    }
  };

  const loadAllNotes = async () => {
    if (!user || !notebookId) return;
    try {
      setError(null);
      
      // Check if offline
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      
      let notesData: Note[];
      if (isOffline) {
        // Load from local cache when offline
        const allLocalNotes = await getAllNotesLocally();
        notesData = allLocalNotes.filter((n) => n.notebookId === notebookId && n.userId === user.uid);
      } else {
        // Get all notes including staple notes (Scratch, Now, Short-Term, Long-term) for search
        notesData = await getNotes(notebookId, undefined, user.uid);
      }
      
      // Exclude staple notes from display, but keep them for search
      // Staple notes have tabId === 'staple'
      const regularNotes = notesData.filter((n) => n && !n.deletedAt && n.tabId !== 'staple');
      setNotes(regularNotes);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notes';
      console.error('Error loading all notes:', err);
      
      // If offline, try to load from local cache as fallback
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        try {
          const allLocalNotes = await getAllNotesLocally();
          const notesData = allLocalNotes.filter((n) => n.notebookId === notebookId && n.userId === user.uid);
          const regularNotes = notesData.filter((n) => n && !n.deletedAt && n.tabId !== 'staple');
          setNotes(regularNotes);
          setError(null); // Clear error since we loaded from cache
        } catch (cacheErr) {
          setError('Unable to load notes. Please check your connection.');
        }
      } else {
      setError(errorMessage);
      }
    }
  };

  const handleCreateNote = async () => {
    if (!user) {
      console.error('handleCreateNote: No user');
      return;
    }

    const isOffline = typeof window !== 'undefined' && !navigator.onLine;
    console.log('handleCreateNote: Starting', { isOffline, notebookId, notebookSlug, userId: user.uid });
    
    // If offline and notebookId is not set, try to get it from cache
    let currentNotebookId = notebookId;
    if (isOffline && !currentNotebookId && user && notebookSlug) {
      try {
        console.log('handleCreateNote: Attempting to load notebook from cache');
        const { getNotebookBySlugLocally } = await import('@/lib/utils/localStorage');
        const cachedNotebook = await getNotebookBySlugLocally(user.uid, notebookSlug);
        if (cachedNotebook) {
          currentNotebookId = cachedNotebook.id;
          setNotebookId(cachedNotebook.id); // Update state
          console.log('handleCreateNote: Loaded notebook from cache', { notebookId: currentNotebookId });
        } else {
          console.warn('handleCreateNote: Notebook not found in cache');
        }
      } catch (cacheError) {
        console.error('Error loading notebook from cache in handleCreateNote:', cacheError);
      }
    }
    
    if (!currentNotebookId) {
      console.error('handleCreateNote: No notebookId available', { notebookId, currentNotebookId, isOffline });
      alert('Notebook not found. Please go online to load it first.');
      return;
    }
    
    let uniqueTitle: string | null = null;

    try {
      // Generate unique title (check local cache if offline)
      if (isOffline) {
        // For offline, use a simple counter-based approach
        const allLocalNotes = await getAllNotesLocally();
        const existingTitles = allLocalNotes
          .filter((n) => n.notebookId === currentNotebookId && n.userId === user.uid && !n.deletedAt)
          .map((n) => n.title.trim().toLowerCase());
        
        const baseTitle = 'Note';
        let counter = 1;
        uniqueTitle = baseTitle;
        while (existingTitles.includes(uniqueTitle.trim().toLowerCase())) {
          uniqueTitle = `${baseTitle}${counter}`;
          counter++;
        }
      } else {
        uniqueTitle = await generateUniqueNoteTitle('New Note', currentNotebookId, user.uid);
      }

      if (!uniqueTitle) {
        throw new Error('Failed to generate unique title');
      }

      // Generate temporary ID for offline notes
      const tempNoteId = isOffline ? `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : undefined;
      const tempTabId = isOffline ? `temp-tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : undefined;

      let newTabId: string;
      let noteId: string;

      if (isOffline) {
        // Offline: Use temporary IDs and save locally
        newTabId = tempTabId!;
        noteId = tempNoteId!;
        
        // Create note locally
        const newNote: Note = {
          id: noteId,
          userId: user.uid,
          notebookId: currentNotebookId,
          tabId: newTabId,
          title: uniqueTitle,
          content: '',
          contentPlain: '',
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          deletedAt: null,
        };
        
        await saveNoteLocally(newNote);
        console.log('Note saved locally:', { noteId, title: uniqueTitle });
        
        // Add to sync queue for when we come back online
        await addToSyncQueue(noteId, {
          title: uniqueTitle,
          content: '',
          contentPlain: '',
          images: [],
          notebookId: currentNotebookId,
          tabId: newTabId,
          userId: user.uid,
        });
        console.log('Note added to sync queue:', { noteId, title: uniqueTitle });
      } else {
        // Online: Create in Firestore
        newTabId = await createTab({
        notebookId: currentNotebookId,
        name: uniqueTitle,
        icon: '📄',
        order: 0,
        isLocked: false,
        isStaple: false,
        createdAt: new Date(),
      });

        noteId = await createNote({
          userId: user.uid,
          notebookId: currentNotebookId,
          tabId: newTabId,
        title: uniqueTitle,
        content: '',
        contentPlain: '',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isArchived: false,
        deletedAt: null,
      });
      }

      const noteSlug = createSlug(uniqueTitle);
      console.log('Navigating to note:', { notebookSlug, noteSlug, title: uniqueTitle });
      
      // Update pending count if offline (note was added to sync queue)
      if (isOffline && typeof window !== 'undefined') {
        const { getSyncQueue } = await import('@/lib/utils/localStorage');
        const queue = await getSyncQueue();
        window.dispatchEvent(new CustomEvent('sync-queue-updated', { detail: { count: queue.length } }));
        console.log('Sync queue updated, count:', queue.length);
      }
      
      // Verify note exists before navigating (especially for offline)
      if (isOffline) {
        const { getAllNotesLocally } = await import('@/lib/utils/localStorage');
        const allLocalNotes = await getAllNotesLocally();
        const createdNote = allLocalNotes.find((n) => n.id === noteId);
        if (!createdNote) {
          throw new Error('Note was not saved locally');
        }
        console.log('Verified note exists locally before navigation');
      }
      
      // Refresh tabs list to include the newly created tab (only if online, as offline tabs are temp)
      if (!isOffline) {
        await refreshTabs();
      }
      
      router.push(`/${notebookSlug}/${noteSlug}`);
    } catch (error) {
      console.error('Error creating note:', error);
      // Show user-friendly error with more details
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (isOffline && uniqueTitle && user) {
        // Check if note was actually created locally
        try {
          const { getAllNotesLocally } = await import('@/lib/utils/localStorage');
          const allLocalNotes = await getAllNotesLocally();
          const createdNote = allLocalNotes.find(
            (n) => n.title === uniqueTitle && n.notebookId === currentNotebookId && n.userId === user.uid
          );
          if (createdNote) {
            // Note was created, just navigate to it
            const noteSlug = createSlug(uniqueTitle);
            console.log('Note found in cache after error, navigating:', { noteSlug, title: uniqueTitle });
            router.push(`/${notebookSlug}/${noteSlug}`);
            return;
          }
        } catch (checkError) {
          console.error('Error checking for created note:', checkError);
        }
        console.error('Failed to create note offline:', errorMessage);
        alert(`Failed to create note offline: ${errorMessage}. Please try again.`);
      } else {
        console.error('Failed to create note:', errorMessage);
        alert(`Failed to create note: ${errorMessage}. Please try again.`);
      }
    }
  };

  const handleTabClick = async (tabId: string) => {
    const tab = getTabById(tabId);
    if (!tab) return;

    // Don't navigate if we're already on this tab
    // (prevents infinite loading when clicking the same tab)
    if (activeTabId === tabId) {
      // Check if we're already on the correct page for this tab
      const currentPath = pathname || '';
      
      if (isStapleNoteTab(tab)) {
        // For staple tabs, check if we're on the note page
        const expectedSlug = createSlug(tab.name);
        if (currentPath.includes(`/${notebookSlug}/${expectedSlug}`)) {
          // Already on this note, don't navigate again
          console.log('[handleTabClick] Already on staple tab, skipping navigation:', tab.name);
          return;
        }
      } else if (tab.name === 'All Notes') {
        // For "All Notes", check if we're on the notebook page with view param
        if (currentPath === `/${notebookSlug}` || currentPath === `/${notebookSlug}?view=all-notes`) {
          console.log('[handleTabClick] Already on All Notes, skipping navigation');
          return;
        }
      } else if (tab.name === 'More') {
        // For "More", check if we're on the more page
        if (currentPath === `/${notebookSlug}/more`) {
          console.log('[handleTabClick] Already on More, skipping navigation');
          return;
        }
      } else {
        // For regular tabs, check if we're on a note in this tab
        // If we're already on a note page and it belongs to this tab, don't navigate
        const noteSlug = currentPath.split('/').pop()?.split('?')[0];
        if (noteSlug && currentPath.startsWith(`/${notebookSlug}/`)) {
          // We're on a note page - check if it belongs to this tab
          // For now, just skip navigation if we're already on a note page
          // (More precise check would require loading the note, which we want to avoid)
          console.log('[handleTabClick] Already on a note page, skipping navigation for tab:', tab.name);
          return;
        }
      }
    }

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

  if (!notebookId || loading) {
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

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pb-16">
      {/* Header Bar for All Notes */}
      {isAllNotesTab && (
        <div className="sticky top-0 bg-bg-primary border-b border-bg-secondary z-20">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => router.back()}
                className="p-1 text-text-primary hover:text-text-secondary hover:bg-bg-secondary rounded-lg transition-colors"
                title="Back"
                aria-label="Back"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <button
                onClick={() => {
                  // Undo/redo not applicable for note list
                }}
                disabled
                className="p-1 text-text-primary hover:text-text-secondary hover:bg-bg-secondary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Undo"
                aria-label="Undo"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6"/>
                  <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
                </svg>
              </button>
              <button
                onClick={() => {
                  // Undo/redo not applicable for note list
                }}
                disabled
                className="p-1 text-text-primary hover:text-text-secondary hover:bg-bg-secondary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Redo"
                aria-label="Redo"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 7v6h-6"/>
                  <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/>
                </svg>
              </button>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (showSearch) {
                    setSearchQuery('');
                  }
                }}
                className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-bg-secondary rounded-lg transition-colors"
                title="Search"
                aria-label="Search"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </button>
              <button
                onClick={handleCreateNote}
                className="flex items-center justify-center w-12 h-12 bg-green-600 hover:bg-green-700 text-white rounded transition-colors font-semibold"
                title="Create New Note"
                aria-label="Create New Note"
              >
                <span className="text-3xl leading-none">+</span>
              </button>
            </div>
          </div>
          {showSearch && (
            <div className="px-4 pb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // Clear previous highlights
                }}
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
            notes={searchQuery ? searchResults : notes}
            notebookId={notebookId}
            onNoteClick={(note) => {
              const noteSlug = createSlug(note.title);
              router.push(`/${notebookSlug}/${noteSlug}`);
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

