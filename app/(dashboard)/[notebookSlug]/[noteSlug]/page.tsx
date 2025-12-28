'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { deleteNote, updateTab, getNotebookBySlug } from '@/lib/firebase/firestore';
import { Note } from '@/lib/types';
import RichTextEditor from '@/components/editor/RichTextEditor';
import BottomNav from '@/components/layout/BottomNav';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Toast from '@/components/common/Toast';
import ErrorMessage from '@/components/common/ErrorMessage';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useNote } from '@/hooks/useNote';
import { useTabs } from '@/hooks/useTabs';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { findNoteTab, getNoteBySlug, generateUniqueNoteTitle } from '@/lib/utils/noteHelpers';
import { createSlug } from '@/lib/utils/slug';

// Helper function to clear ALL highlights from the entire document
// Root cause: TipTap's unsetHighlight() only works on current selection
// Solution: Select entire document, remove highlights, restore selection
function clearAllHighlights(editor: any) {
  if (!editor) return;
  
  try {
    const { state } = editor;
    const { doc, selection } = state;
    const docSize = doc.content.size;
    
    if (docSize === 0) return;
    
    // Save current selection
    const savedAnchor = selection.anchor;
    const savedHead = selection.head;
    
    // Select entire document and remove all highlights
    editor.chain()
      .setTextSelection({ from: 0, to: docSize })
      .unsetHighlight()
      .setTextSelection({ 
        from: Math.min(savedAnchor, docSize), 
        to: Math.min(savedHead, docSize) 
      })
      .run();
  } catch (err) {
    console.error('Error clearing highlights:', err);
    // Fallback: try without selection restore
    try {
      const { doc } = editor.state;
      const docSize = doc.content.size;
      if (docSize > 0) {
        editor.chain()
          .setTextSelection({ from: 0, to: docSize })
          .unsetHighlight()
          .run();
      }
    } catch (fallbackErr) {
      console.error('Fallback highlight clear failed:', fallbackErr);
    }
  }
}

// Helper function to highlight search results in TipTap
function highlightSearchResults(editor: any, query: string) {
  if (!editor || !query) return;
  
  try {
    // Clear all existing highlights first
    clearAllHighlights(editor);
    
    // Get document and find text positions
    const { doc } = editor.state;
    const queryLower = query.toLowerCase();
    const matches: Array<{ from: number; to: number }> = [];
    
    // First pass: find all matches and their document positions
    doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        const nodeText = node.text;
        const nodeTextLower = nodeText.toLowerCase();
        let searchIndex = 0;
        
        while (true) {
          const index = nodeTextLower.indexOf(queryLower, searchIndex);
          if (index === -1) break;
          
          const from = pos + index;
          const to = from + query.length;
          
          if (to <= pos + nodeText.length) {
            matches.push({ from, to });
          }
          
          searchIndex = index + 1;
        }
      }
    });
    
    // Second pass: apply highlights (in reverse to maintain positions)
    matches.reverse().forEach((match) => {
      try {
        editor.chain()
          .setTextSelection({ from: match.from, to: match.to })
          .setHighlight({ color: '#fbbf24' })
          .run();
      } catch (err) {
        // Skip if highlighting fails
      }
    });
    
    // Restore cursor position (move to end of document or keep current)
    const { doc: finalDoc } = editor.state;
    const currentPos = editor.state.selection.anchor;
    if (currentPos > finalDoc.content.size) {
      editor.commands.setTextSelection(finalDoc.content.size);
    }
    
    // Focus editor
    editor.commands.focus();
  } catch (err) {
    console.error('Error highlighting search results:', err);
    editor.commands.focus();
  }
}

export default function NoteEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const notebookSlug = params.notebookSlug as string;
  const noteSlug = params.noteSlug as string;
  
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [initialNote, setInitialNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editor, setEditorState] = useState<any>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isSavedToCloud, setIsSavedToCloud] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const isUpdatingUrlRef = useRef(false); // Prevent infinite loop from URL updates
  const isLoadingNoteRef = useRef(false); // Prevent multiple simultaneous loadNote calls

  // Check sync queue periodically to show pending count (especially useful when offline)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkSyncQueue = async () => {
      try {
        const { getSyncQueue } = await import('@/lib/utils/localStorage');
        const queue = await getSyncQueue();
        setPendingSyncCount(queue.length);
      } catch (error) {
        console.error('Error checking sync queue:', error);
      }
    };

    // Check immediately
    checkSyncQueue();

    // Check every 5 seconds
    const interval = setInterval(checkSyncQueue, 5000);

    // Listen for sync events
    const handleSync = () => checkSyncQueue();
    window.addEventListener('note-synced', handleSync);
    window.addEventListener('note-sync-error', handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('note-synced', handleSync);
      window.removeEventListener('note-sync-error', handleSync);
    };
  }, []);

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };

    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showShareMenu]);

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
  const { tabs, activeTabId, setActiveTabId, getTabById, refreshTabs } = useTabs({ 
    notebookId: notebookId || '',
    defaultTabName: 'Scratch'
  });

  const { navigateToTab } = useTabNavigation({
    notebookId: notebookId || '',
    notebookSlug: notebookSlug,
    userId: user?.uid || '',
  });

  const {
    note,
    content,
    plainText,
    isSaving,
    setNote,
    setEditor,
    saveNote,
    handleContentChange,
    handleTitleChange,
  } = useNote({
    noteId: initialNote?.id || '',
    initialNote,
    onSaveComplete: async () => {
      const now = new Date();
      setLastSaved(now);
      setIsSavedToCloud(true);
      // Update tab name if it's not a staple note and not a temp-tab ID
      if (note && note.tabId && note.tabId !== 'staple' && !note.tabId.startsWith('temp-tab-')) {
        await updateTab(note.tabId, { name: note.title || 'Untitled Note' });
        await refreshTabs();
      }
    },
  });

  useEffect(() => {
    // Don't load if we're updating the URL or already loading (prevents infinite loop)
    const shouldLoad = async () => {
      if (isUpdatingUrlRef.current || isLoadingNoteRef.current || !noteSlug || !notebookId) {
        return;
      }
      
      // If we have user, load immediately
      if (user) {
        loadNote();
        return;
      }
      
      // If offline and no user, check IndexedDB auth state
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        try {
          const { getAuthState } = await import('@/lib/utils/authState');
          const authState = await getAuthState();
          if (authState) {
            // IndexedDB has auth state - load note even though user is null
            console.log('[useEffect] Offline: IndexedDB has auth state, loading note');
            loadNote();
          }
        } catch (error) {
          console.error('[useEffect] Error checking IndexedDB auth:', error);
        }
      }
    };
    
    shouldLoad();
  }, [user, noteSlug, notebookId]);

  // Save note when navigating away
  useEffect(() => {
    return () => {
      // Component unmounting - save immediately
      if (note && editor) {
        saveNote(true); // Force immediate save
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on unmount, not when note/editor changes

  // Monitor online/offline status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsSavedToCloud(false); // Reset cloud save status when offline
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for sync events to update cloud save status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleSync = (event: Event) => {
      // Check if this sync event is for the current note
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.noteId) {
        // If event has a noteId, only update if it matches current note
        if (note?.id && customEvent.detail.noteId === note.id) {
      setIsSavedToCloud(true);
        }
      } else {
        // If no noteId in event, update for any sync (backward compatibility)
        // But also check if we have a pending sync for this note
        if (note?.id) {
          // Check if this note is in the sync queue
          const checkSyncQueue = async () => {
            try {
              const { getSyncQueue } = await import('@/lib/utils/localStorage');
              const queue = await getSyncQueue();
              const isInQueue = queue.some((item) => item.noteId === note.id);
              if (!isInQueue) {
                // Note is no longer in queue, so it must have synced
                setIsSavedToCloud(true);
              }
            } catch (error) {
              console.error('Error checking sync queue:', error);
            }
          };
          checkSyncQueue();
        } else {
          setIsSavedToCloud(true);
        }
      }
    };
    
    window.addEventListener('note-synced', handleSync);
    
    return () => {
      window.removeEventListener('note-synced', handleSync);
    };
  }, [note?.id]);

  // Only update active tab when noteId changes (switching notes), not when note object changes
  useEffect(() => {
    if (initialNote && tabs.length > 0) {
      const noteTab = findNoteTab(initialNote, tabs);
      if (noteTab) {
        setActiveTabId(noteTab.id);
      }
    }
  }, [initialNote?.id, tabs, setActiveTabId]);

  // Clear search highlights when switching notes
  useEffect(() => {
    if (editor) {
      clearAllHighlights(editor);
      setShowFind(false);
      setFindQuery('');
    }
  }, [initialNote?.id, editor]);

  const loadNote = async () => {
    // Prevent multiple simultaneous calls
    if (isLoadingNoteRef.current) {
      console.log('[loadNote] Already loading, skipping duplicate call');
      return;
    }
    
    try {
      isLoadingNoteRef.current = true;
      setError(null);
      setLoading(true);
      
      // Get userId - check IndexedDB if user is null and offline
      let currentUserId: string | null = null;
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      
      if (user?.uid) {
        currentUserId = user.uid;
      } else if (isOffline) {
        // When offline and user is null, check IndexedDB auth state
        const { getAuthState } = await import('@/lib/utils/authState');
        const authState = await getAuthState();
        if (authState) {
          currentUserId = authState.userId;
          console.log('[loadNote] Offline: Using IndexedDB auth state, userId:', currentUserId);
        } else {
          // No auth state anywhere
          console.log('[loadNote] No user and no IndexedDB auth state');
          isLoadingNoteRef.current = false;
          return;
        }
      } else {
        // Online and no user - can't proceed
        console.log('[loadNote] Online and no user');
        isLoadingNoteRef.current = false;
        return;
      }
      
      if (!currentUserId) {
        isLoadingNoteRef.current = false;
        return;
      }
      
      // If offline and notebookId is not set, try to get it from cache
      let currentNotebookId = notebookId;
      if (isOffline && !currentNotebookId && currentUserId && notebookSlug) {
        try {
          const { getNotebookBySlugLocally } = await import('@/lib/utils/localStorage');
          const cachedNotebook = await getNotebookBySlugLocally(currentUserId, notebookSlug);
          if (cachedNotebook) {
            currentNotebookId = cachedNotebook.id;
            setNotebookId(cachedNotebook.id); // Update state so it's available for future calls
          }
        } catch (cacheError) {
          console.error('Error loading notebook from cache in loadNote:', cacheError);
        }
      }
      
      if (!currentNotebookId) {
        // If still no notebookId, we can't proceed
        if (isOffline) {
          setError('Notebook not found in local cache. Please go online to load it first.');
        } else {
          setError('Notebook not found');
        }
        return;
      }
      
      let noteData: Note | null = null;
      
      if (isOffline && currentUserId) {
        // Try local cache first when offline
        try {
          const { getAllNotesLocally } = await import('@/lib/utils/localStorage');
          const allLocalNotes = await getAllNotesLocally();
          const allNotes = allLocalNotes.filter((n) => n.notebookId === currentNotebookId && n.userId === currentUserId);
          
          // Check if it's a staple note slug
          const stapleSlugMap: Record<string, string> = {
            'scratch': 'Scratch',
            'now': 'Now',
            'short-term': 'Short-Term',
            'long-term': 'Long-term',
          };
          
          if (stapleSlugMap[noteSlug]) {
            const title = stapleSlugMap[noteSlug];
            noteData = allNotes.find((n) => n.title === title && n.tabId === 'staple') || null;
          } else {
            // Regular note - find by slug
            const matchingNotes = allNotes.filter((note) => {
              const noteSlugFromTitle = createSlug(note.title);
              return noteSlugFromTitle === noteSlug;
            });
            
            if (matchingNotes.length > 0) {
              matchingNotes.sort((a, b) => {
                const aTime = a.updatedAt?.getTime() || 0;
                const bTime = b.updatedAt?.getTime() || 0;
                return bTime - aTime;
              });
              noteData = matchingNotes[0];
            }
          }
        } catch (cacheError) {
          console.error('Error loading from cache:', cacheError);
        }
      }
      
      // If not found in cache and online, try Firestore
      if (!noteData && !isOffline && currentNotebookId && currentUserId) {
        noteData = await getNoteBySlug(noteSlug, currentNotebookId, currentUserId);
      }
      
      if (noteData) {
        setInitialNote(noteData);
        setTitleValue(noteData.title || '');
        
        // Update URL if slug doesn't match (e.g., if title changed)
        // But only if we're not already updating the URL (prevents infinite loop)
        const expectedSlug = createSlug(noteData.title);
        if (expectedSlug !== noteSlug && !isUpdatingUrlRef.current) {
          isUpdatingUrlRef.current = true;
          router.replace(`/${notebookSlug}/${expectedSlug}`);
          // Reset flag after a short delay to allow navigation to complete
          setTimeout(() => {
            isUpdatingUrlRef.current = false;
          }, 1000);
        }
      } else if (!isOffline) {
        // Only set error if online and note not found
        setError('Note not found');
      } else {
        // Offline and note not found in cache - try to create if it's a staple note
        const { isStapleNoteSlug } = await import('@/lib/utils/noteHelpers');
        if (isStapleNoteSlug(noteSlug) && currentUserId && currentNotebookId) {
          // Try to ensure staple note exists (will create locally if offline)
          const { ensureStapleNoteExists } = await import('@/lib/utils/noteHelpers');
          const stapleSlugMap: Record<string, string> = {
            'scratch': 'Scratch',
            'now': 'Now',
            'short-term': 'Short-Term',
            'long-term': 'Long-term',
          };
          const stapleName = stapleSlugMap[noteSlug];
          if (stapleName) {
            const createdStapleNote = await ensureStapleNoteExists(stapleName, currentNotebookId, currentUserId);
            if (createdStapleNote) {
              setInitialNote(createdStapleNote);
              setTitleValue(createdStapleNote.title || '');
              setError(null);
              return; // Exit early since we found/created the note
            }
          }
        }
        // Offline and note not found in cache (and not a staple note)
        setError('Note not found in local cache');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load note';
      console.error('Error loading note:', err);
      
      // If offline, try local cache as fallback
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        // Get userId from IndexedDB if user is null
        let fallbackUserId: string | undefined = user?.uid;
        if (!fallbackUserId) {
          try {
            const { getAuthState } = await import('@/lib/utils/authState');
            const authState = await getAuthState();
            fallbackUserId = authState?.userId || undefined;
          } catch (error) {
            console.error('[loadNote] Error getting auth state in catch block:', error);
          }
        }
        
        if (!fallbackUserId) {
          setError('Not authenticated');
          return;
        }
        
        // Try to get notebookId from cache if not set
        let fallbackNotebookId = notebookId;
        if (!fallbackNotebookId && notebookSlug) {
          try {
            const { getNotebookBySlugLocally } = await import('@/lib/utils/localStorage');
            const cachedNotebook = await getNotebookBySlugLocally(fallbackUserId, notebookSlug);
            if (cachedNotebook) {
              fallbackNotebookId = cachedNotebook.id;
            }
          } catch (cacheError) {
            console.error('Error loading notebook from cache in catch block:', cacheError);
          }
        }
        
        if (!fallbackNotebookId) {
          setError('Notebook not found in local cache');
          return;
        }
        
        try {
          const { getAllNotesLocally } = await import('@/lib/utils/localStorage');
          const allLocalNotes = await getAllNotesLocally();
          const allNotes = allLocalNotes.filter((n) => n.notebookId === fallbackNotebookId && n.userId === fallbackUserId);
          
          const stapleSlugMap: Record<string, string> = {
            'scratch': 'Scratch',
            'now': 'Now',
            'short-term': 'Short-Term',
            'long-term': 'Long-term',
          };
          
          let noteData: Note | null = null;
          
          if (stapleSlugMap[noteSlug]) {
            const title = stapleSlugMap[noteSlug];
            noteData = allNotes.find((n) => n.title === title && n.tabId === 'staple') || null;
          } else {
            const matchingNotes = allNotes.filter((note) => {
              const noteSlugFromTitle = createSlug(note.title);
              return noteSlugFromTitle === noteSlug;
            });
            
            if (matchingNotes.length > 0) {
              matchingNotes.sort((a, b) => {
                const aTime = a.updatedAt?.getTime() || 0;
                const bTime = b.updatedAt?.getTime() || 0;
                return bTime - aTime;
              });
              noteData = matchingNotes[0];
            }
          }
          
          if (noteData) {
            setInitialNote(noteData);
            setTitleValue(noteData.title || '');
            setError(null);
          } else {
            setError('Note not found in local cache');
          }
        } catch (cacheError) {
          setError('Unable to load note. Please check your connection.');
        }
      } else {
      setError(errorMessage);
      }
    } finally {
      setLoading(false);
      isLoadingNoteRef.current = false;
    }
  };

  const handleTitleChangeWithUpdate = async (newTitle: string) => {
    setTitleValue(newTitle);
    await handleTitleChange(newTitle);
    
    // Update tab name if it's not a staple note and not a temp-tab ID
    if (note && note.tabId && note.tabId !== 'staple' && !note.tabId.startsWith('temp-tab-')) {
      await updateTab(note.tabId, { name: newTitle || 'Untitled Note' });
      await refreshTabs();
    }
    
    // Update URL with new slug
    if (note && notebookSlug) {
      const newSlug = createSlug(newTitle);
      if (newSlug !== noteSlug) {
        router.replace(`/${notebookSlug}/${newSlug}`);
      }
    }
  };

  const handleTabClick = async (tabId: string) => {
    // Save current note before switching - ensure images are saved
    // Give it a moment to ensure editor content is fully updated
    if (editor && note) {
      // Force editor to update its content
      const html = editor.getHTML();
      // Trigger a save with current content (including any images)
    await saveNote(true);
      // Wait longer to ensure save completes and Firestore processes it
      // This is critical for images which need to be extracted and saved
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const tab = getTabById(tabId);
    if (!tab) return;

    setActiveTabId(tabId);

    // Use unified navigation
    await navigateToTab(tab);
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
        const { getAllNotesLocally } = await import('@/lib/utils/localStorage');
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
        const { generateUniqueNoteTitle } = await import('@/lib/utils/noteHelpers');
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
        const { saveNoteLocally, addToSyncQueue } = await import('@/lib/utils/localStorage');
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
        const { createNote, createTab } = await import('@/lib/firebase/firestore');
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

  const handleBack = async () => {
    await saveNote(true);
    router.back();
  };

  const handleDelete = () => {
    if (!note) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!note) return;
    try {
      setIsDeleting(true);
      await deleteNote(note.id);
      setShowDeleteConfirm(false);
      router.back();
    } catch (error) {
      console.error('Error deleting note:', error);
      setShowDeleteConfirm(false);
      setIsDeleting(false);
    }
  };

  // Show loading spinner during initial load, notebook loading, or deletion
  if (!notebookId || loading || isDeleting) {
    return <LoadingSpinner message={isDeleting ? "Deleting note..." : "Loading note..."} />;
  }

  // Only show error if we have an actual error (not just missing note during load)
  if (error) {
    return (
      <ErrorMessage
        message={error}
        onRetry={loadNote}
      />
    );
  }

  // Only show "Note not found" if we've finished loading and note is still null
  if (!note && !loading) {
    return (
      <ErrorMessage
        message="Note not found"
        onRetry={loadNote}
      />
    );
  }

  // If note is null but we might still be loading, show loading spinner
  if (!note) {
    return <LoadingSpinner message="Loading note..." />;
  }

  const formatDate = (date: Date) => {
    // Format: MM/DD/YY HH:MM:SS
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const getSaveLocation = () => {
    // Determine where the note was last saved
    if (!isOnline) return 'Offline';
    if (isSavedToCloud) return 'Cloud';
    if (lastSaved) return 'Local';
    // If we have a note, check if it was recently updated (within last minute = likely cloud saved)
    if (note) {
      const now = new Date();
      const noteAge = now.getTime() - note.updatedAt.getTime();
      // If note was updated in last 2 minutes and we're online, assume it's cloud saved
      if (noteAge < 120000 && isOnline) return 'Cloud';
    }
    return 'Local'; // Default fallback
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pb-16">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="sticky top-0 z-30 bg-red-900/80 border-b border-red-600 px-4 py-2">
          <p className="text-xs text-red-200 text-center">
            <strong>⚠️ You're offline</strong> - Your notes are being saved locally and will sync when you're back online. <strong>Your data is safe.</strong>
          </p>
        </div>
      )}
      {/* Header Bar */}
      <div className={`sticky ${!isOnline ? 'top-8' : 'top-0'} bg-bg-primary border-b border-bg-secondary z-20`}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-1">
            <button
              onClick={handleBack}
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
                if (editor) {
                  editor.chain().focus().undo().run();
                }
              }}
              disabled={editor && !editor.can().undo()}
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
                if (editor) {
                  editor.chain().focus().redo().run();
                }
              }}
              disabled={editor && !editor.can().redo()}
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
          <div className="flex-1 flex items-center justify-center">
            {/* Only show active/transient status in top bar */}
            {isSaving && (
              <span className="text-xs text-text-secondary">
                {isOnline ? 'Saving to cloud...' : 'Saving locally...'}
              </span>
            )}
            {!isSaving && !isOnline && (
              <span className="text-xs text-red-400">⚠️ Offline</span>
            )}
            {!isSaving && pendingSyncCount > 0 && (
              <span className="text-xs text-orange-400">
                {pendingSyncCount} pending
              </span>
            )}
            {/* When idle and all good, show nothing in top bar */}
          </div>
          <div className="flex items-center">
            {/* Image Upload Button */}
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!editor || !user?.uid || !initialNote?.id) return;
                
                // Create file input element
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';
                
                // Handle file selection
                fileInput.onchange = async (event: any) => {
                  const file = (event.target as HTMLInputElement).files?.[0];
                  if (!file || !file.type.startsWith('image/')) {
                    // Clean up
                    fileInput.remove();
                    return;
                  }
                  
                  // Show resize dialog before uploading
                  const selectedSize = await new Promise<string | null>((resolve) => {
                    const dialog = document.createElement('div');
                    dialog.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
                    dialog.innerHTML = `
                      <div class="bg-bg-secondary border border-bg-primary rounded-lg p-6 max-w-sm w-full mx-4">
                        <h3 class="text-lg font-semibold text-text-primary mb-4">Choose Image Size</h3>
                        <div class="flex flex-col gap-2 mb-4">
                          <button class="px-4 py-2 bg-bg-primary text-text-primary rounded hover:bg-bg-secondary border border-bg-secondary text-left" data-size="100px">Small (100px)</button>
                          <button class="px-4 py-2 bg-bg-primary text-text-primary rounded hover:bg-bg-secondary border border-bg-secondary text-left" data-size="150px">Medium (150px)</button>
                          <button class="px-4 py-2 bg-bg-primary text-text-primary rounded hover:bg-bg-secondary border border-bg-secondary text-left" data-size="300px">Large (300px)</button>
                          <button class="px-4 py-2 bg-bg-primary text-text-primary rounded hover:bg-bg-secondary border border-bg-secondary text-left" data-size="auto">Original Size</button>
                        </div>
                        <button class="w-full px-4 py-2 bg-bg-primary text-text-primary rounded hover:bg-bg-secondary border border-bg-secondary" data-cancel>Cancel</button>
                      </div>
                    `;
                    document.body.appendChild(dialog);
                    
                    dialog.querySelectorAll('button[data-size]').forEach((btn) => {
                      btn.addEventListener('click', () => {
                        const size = (btn as HTMLElement).dataset.size;
                        document.body.removeChild(dialog);
                        resolve(size || null);
                      });
                    });
                    
                    dialog.querySelector('button[data-cancel]')?.addEventListener('click', () => {
                      document.body.removeChild(dialog);
                      resolve(null);
                    });
                  });
                  
                  if (!selectedSize) {
                    fileInput.remove();
                    return;
                  }
                  
                  try {
                    const { uploadImage } = await import('@/lib/firebase/storage');
                    const imageUrl = await uploadImage(file, user.uid, initialNote.id);
                    
                    // Insert image with selected size
                    if (selectedSize === 'auto') {
                      editor.chain().focus().setImage({ src: imageUrl }).run();
                    } else {
                      editor.chain().focus().setImage({ src: imageUrl, width: selectedSize }).run();
                    }
                    
                    // Force immediate save to ensure image is persisted
                    // Wait for editor to update HTML, then save and wait for completion
                    // Use multiple checks to ensure editor HTML is updated
                    let attempts = 0;
                    let htmlContainsImage = false;
                    while (attempts < 10 && !htmlContainsImage) {
                      await new Promise(resolve => setTimeout(resolve, 100));
                      const currentHtml = editor.getHTML();
                      htmlContainsImage = currentHtml.includes(imageUrl);
                      attempts++;
                    }
                    
                    if (editor && note) {
                      // Force immediate save with current content (including the new image)
                      // Wait for save to complete before continuing
                      await saveNote(true);
                      // Give additional time for Firestore to process and sync
                      await new Promise(resolve => setTimeout(resolve, 300));
                    }
                  } catch (error) {
                    console.error('Error uploading image:', error);
                  } finally {
                    // Clean up file input
                    fileInput.remove();
                  }
                };
                
                // Handle cancellation
                fileInput.oncancel = () => {
                  fileInput.remove();
                };
                
                // Add to DOM, trigger click, then remove
                document.body.appendChild(fileInput);
                // Use setTimeout to ensure element is in DOM before clicking
                setTimeout(() => {
                  fileInput.click();
                }, 0);
              }}
              disabled={!editor || !user?.uid || !initialNote?.id}
              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-bg-secondary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Insert Image (Images only)"
              aria-label="Insert Image"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
            <div className="relative" ref={shareMenuRef}>
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="p-2 text-purple-400 hover:text-purple-300 hover:bg-bg-secondary rounded-lg transition-colors"
                title="Share Note"
                aria-label="Share Note"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>
              {showShareMenu && (
                <div className="absolute right-0 top-full mt-2 bg-bg-secondary border border-bg-primary rounded-lg shadow-lg z-50 min-w-[200px]">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-bg-primary">
                    <span className="text-xs font-semibold text-text-primary">Share Note</span>
                    <button
                      onClick={() => setShowShareMenu(false)}
                      className="text-text-secondary hover:text-text-primary transition-colors"
                      aria-label="Close menu"
                    >
                      ✕
                    </button>
                  </div>
            <button
              onClick={async () => {
                if (!note) return;
                      const textToShare = `${note.title || 'Untitled Note'}\n\n${plainText || ''}`;
                      try {
                        await navigator.clipboard.writeText(textToShare);
                        setToast({ message: 'Note copied to clipboard!', type: 'success' });
                        setShowShareMenu(false);
                        setTimeout(() => setToast(null), 3000);
                      } catch (err) {
                        setToast({ message: 'Failed to copy note. Please try again.', type: 'error' });
                        setTimeout(() => setToast(null), 3000);
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-bg-primary transition-colors"
                  >
                    📋 Copy to Clipboard
                  </button>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!note) return;
                      setShowShareMenu(false);
                
                const textToShare = `${note.title || 'Untitled Note'}\n\n${plainText || ''}`;
                      const mailtoLink = `mailto:?subject=${encodeURIComponent(note.title || 'Untitled Note')}&body=${encodeURIComponent(textToShare)}`;
                      
                      // Check if we're on mobile (mailto usually works on mobile)
                      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                      
                      // Try to open mailto link
                      let mailtoWorked = false;
                      
                      // Method 1: Try window.location (works on mobile, may not work on desktop without email client)
                      try {
                        // On mobile, this should work
                        // On desktop without email client, it will silently fail
                        window.location.href = mailtoLink;
                        mailtoWorked = true;
                        setToast({ message: 'Opening email...', type: 'info' });
                        setTimeout(() => setToast(null), 2000);
                      } catch (err) {
                        // Fall through to clipboard
                      }
                      
                      // If mailto didn't work (or we're on desktop), offer clipboard as fallback
                      // Wait a moment to see if mailto actually opened
                      setTimeout(async () => {
                        // If on desktop or if mailto might not have worked, offer clipboard
                        if (!isMobile) {
                          try {
                            await navigator.clipboard.writeText(textToShare);
                            setToast({ 
                              message: 'Email client not available. Note copied to clipboard! You can paste it into your email.', 
                              type: 'info' 
                            });
                            setTimeout(() => setToast(null), 4000);
                          } catch (clipErr) {
                            setToast({ 
                              message: 'Email client not available. Please copy the note manually.', 
                              type: 'error' 
                            });
                            setTimeout(() => setToast(null), 3000);
                          }
                        }
                      }, 500);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-bg-primary transition-colors"
                  >
                    📧 Share via Email
                  </button>
                  {navigator.share && (
                    <button
                      onClick={async () => {
                        if (!note) return;
                        // Close menu immediately so user doesn't see it while native dialog is open
                        setShowShareMenu(false);
                        try {
                          // Check if share is actually available
                          if (!navigator.share) {
                            setToast({ message: 'Share not available on this device', type: 'error' });
                            setTimeout(() => setToast(null), 3000);
                            return;
                          }
                          
                    await navigator.share({
                      title: note.title || 'Untitled Note',
                      text: plainText || '',
                    });
                          setToast({ message: 'Shared successfully!', type: 'success' });
                          setTimeout(() => setToast(null), 2000);
                  } catch (err: any) {
                    if (err.name === 'AbortError') {
                            // User cancelled native share dialog - no action needed, menu already closed
                            // The native dialog has its own close/cancel button
                          } else if (err.name === 'NotAllowedError' || err.name === 'TypeError') {
                            // Share not supported or failed, fallback to clipboard
                            const textToShare = `${note.title || 'Untitled Note'}\n\n${plainText || ''}`;
                try {
                  await navigator.clipboard.writeText(textToShare);
                              setToast({ message: 'Share not available. Copied to clipboard instead!', type: 'info' });
                              setTimeout(() => setToast(null), 3000);
                            } catch (clipErr) {
                              setToast({ message: 'Share failed. Please try copying manually.', type: 'error' });
                              setTimeout(() => setToast(null), 3000);
                            }
                          } else {
                            setToast({ message: 'Failed to share. Please try again.', type: 'error' });
                            setTimeout(() => setToast(null), 3000);
                          }
                }
              }}
                      className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-bg-primary transition-colors"
                    >
                      📤 Share via App
            </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!note) return;
                      // Export as plain text file
                      const textToShare = `${note.title || 'Untitled Note'}\n\n${plainText || ''}`;
                      const blob = new Blob([textToShare], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${(note.title || 'Untitled Note').replace(/[^a-z0-9]/gi, '_')}.txt`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      setShowShareMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-bg-primary transition-colors"
                  >
                    💾 Export as Text File
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setShowFind(!showFind);
                if (showFind && editor) {
                  // Clear highlights when closing search
                  clearAllHighlights(editor);
                }
                if (showFind) {
                  setFindQuery('');
                }
              }}
              className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-bg-secondary rounded-lg transition-colors"
              title="Find"
              aria-label="Find"
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
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Note"
        message={`Are you sure you want to delete "${note?.title || 'this note'}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Note Title and Date */}
      <div className="bg-bg-secondary border-b border-bg-secondary px-4 py-3">
        <div className="max-w-4xl mx-auto">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={() => {
                setIsEditingTitle(false);
                handleTitleChangeWithUpdate(titleValue);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingTitle(false);
                  handleTitleChangeWithUpdate(titleValue);
                }
                if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                  setTitleValue(note.title || 'Untitled Note');
                }
              }}
              className="text-2xl font-bold bg-transparent border-b-2 border-text-secondary focus:border-text-primary focus:outline-none w-full text-text-primary"
              autoFocus
            />
          ) : (
            <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 
                className="text-2xl font-bold cursor-pointer hover:text-text-secondary"
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit title"
              >
                {note.title || 'Untitled Note'}
              </h1>
              <span className="text-sm text-text-secondary">
                  {` • Last saved: ${formatDate(note.updatedAt)} (${getSaveLocation()})`}
              </span>
            </div>
              {note.tabId && note.tabId !== 'staple' && (
                <button
                  onClick={handleDelete}
                  className="p-2 text-red-500 hover:text-red-400 hover:bg-bg-secondary rounded-lg transition-colors"
                  title="Delete Note"
                  aria-label="Delete Note"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Find Bar */}
      {showFind && (
        <div className="bg-bg-secondary border-b border-bg-secondary px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <input
              type="text"
              value={findQuery}
              onChange={(e) => {
                setFindQuery(e.target.value);
                // Clear previous highlights
                if (editor) {
                  clearAllHighlights(editor);
                }
                // Highlight matches as user types
                if (editor && e.target.value) {
                  highlightSearchResults(editor, e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editor && findQuery) {
                  highlightSearchResults(editor, findQuery);
                }
                if (e.key === 'Escape') {
                  if (editor) {
                    clearAllHighlights(editor);
                  }
                  setShowFind(false);
                  setFindQuery('');
                }
              }}
              placeholder="Search in note..."
              className="flex-1 px-3 py-2 bg-bg-primary border border-text-secondary rounded text-text-primary focus:outline-none focus:border-text-primary"
              autoFocus
            />
            <button
              onClick={() => {
                if (editor && findQuery) {
                  highlightSearchResults(editor, findQuery);
                }
              }}
              className="px-4 py-2 bg-bg-primary text-text-primary rounded hover:bg-bg-secondary"
            >
              Find
            </button>
            <button
              onClick={() => {
                if (editor) {
                  clearAllHighlights(editor);
                }
                setShowFind(false);
                setFindQuery('');
              }}
              className="px-4 py-2 text-text-secondary hover:text-text-primary"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="max-w-4xl mx-auto">
        <RichTextEditor
          userId={user?.uid}
          noteId={initialNote?.id}
          content={content}
          onChange={handleContentChange}
          placeholder="Start writing..."
          onEditorReady={(ed) => {
            setEditor(ed);
            setEditorState(ed);
          }}
          onCreateNote={handleCreateNote}
        />
      </div>

      {/* Bottom Navigation */}
      {tabs.length > 0 && (
        <BottomNav
          tabs={tabs}
          activeTabId={activeTabId}
          onTabClick={handleTabClick}
          onCreateNote={handleCreateNote}
        />
      )}
      <Toast
        message={toast?.message || ''}
        type={toast?.type || 'info'}
        isVisible={!!toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

