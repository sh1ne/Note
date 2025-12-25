'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { deleteNote, updateTab, getNotebookBySlug } from '@/lib/firebase/firestore';
import { Note } from '@/lib/types';
import RichTextEditor from '@/components/editor/RichTextEditor';
import BottomNav from '@/components/layout/BottomNav';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useNote } from '@/hooks/useNote';
import { useTabs } from '@/hooks/useTabs';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { findNoteTab, getNoteBySlug, generateUniqueNoteTitle } from '@/lib/utils/noteHelpers';
import { createSlug } from '@/lib/utils/slug';

// Helper function to highlight search results in TipTap
function highlightSearchResults(editor: any, query: string) {
  if (!editor || !query) return;
  
  try {
    // Clear all existing highlights
    editor.chain().unsetHighlight().run();
    
    // Get document and find text positions
    const { doc } = editor.state;
    const queryLower = query.toLowerCase();
    let textOffset = 0;
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

  // Look up notebook by slug
  useEffect(() => {
    const loadNotebook = async () => {
      if (!user || !notebookSlug) return;
      
      try {
        const notebook = await getNotebookBySlug(user.uid, notebookSlug);
        if (!notebook) {
          setError('Notebook not found');
          return;
        }
        setNotebookId(notebook.id);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load notebook';
        console.error('Error loading notebook:', err);
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
      // Update tab name if it's not a staple note
      if (note && note.tabId && note.tabId !== 'staple') {
        await updateTab(note.tabId, { name: note.title || 'Untitled Note' });
        await refreshTabs();
      }
    },
  });

  useEffect(() => {
    if (user && noteSlug && notebookId) {
      loadNote();
    }
  }, [user, noteSlug, notebookId]);

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
    
    const handleSync = () => {
      setIsSavedToCloud(true);
    };
    
    window.addEventListener('note-synced', handleSync);
    
    return () => {
      window.removeEventListener('note-synced', handleSync);
    };
  }, []);

  useEffect(() => {
    if (note && tabs.length > 0) {
      const noteTab = findNoteTab(note, tabs);
      if (noteTab) {
        setActiveTabId(noteTab.id);
      }
    }
  }, [note, tabs, setActiveTabId]);

  const loadNote = async () => {
    try {
      setError(null);
      setLoading(true);
      
      if (!notebookId || !user) return;
      
      const noteData = await getNoteBySlug(noteSlug, notebookId, user.uid);
      
      if (noteData) {
        setInitialNote(noteData);
        setTitleValue(noteData.title || '');
        
        // Update URL if slug doesn't match (e.g., if title changed)
        const expectedSlug = createSlug(noteData.title);
        if (expectedSlug !== noteSlug) {
          router.replace(`/${notebookSlug}/${expectedSlug}`);
        }
      } else {
        setError('Note not found');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load note';
      console.error('Error loading note:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleTitleChangeWithUpdate = async (newTitle: string) => {
    setTitleValue(newTitle);
    await handleTitleChange(newTitle);
    
    // Update tab name if it's not a staple note
    if (note && note.tabId && note.tabId !== 'staple') {
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
    // Save current note before switching
    await saveNote(true);

    const tab = getTabById(tabId);
    if (!tab) return;

    setActiveTabId(tabId);

    // Use unified navigation
    await navigateToTab(tab);
  };

  const handleCreateNote = async () => {
    if (!notebookId || !user) return;
    const { createNote, createTab } = await import('@/lib/firebase/firestore');
    try {
      // Generate unique title
      const uniqueTitle = await generateUniqueNoteTitle('New Note', notebookId, user.uid);
      const noteSlug = createSlug(uniqueTitle);
      
      const newTabId = await createTab({
        notebookId,
        name: uniqueTitle,
        icon: '📄',
        order: 0,
        isLocked: false,
        isStaple: false,
        createdAt: new Date(),
      });

      const newNoteId = await createNote({
        userId: user.uid,
        notebookId,
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

      router.push(`/${notebookSlug}/${noteSlug}`);
    } catch (error) {
      console.error('Error creating note:', error);
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
      await deleteNote(note.id);
      setShowDeleteConfirm(false);
      router.back();
    } catch (error) {
      console.error('Error deleting note:', error);
      setShowDeleteConfirm(false);
    }
  };

  if (!notebookId || loading) {
    return <LoadingSpinner message="Loading note..." />;
  }

  if (error || !note) {
    return (
      <ErrorMessage
        message={error || 'Note not found'}
        onRetry={error ? loadNote : undefined}
      />
    );
  }

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Show relative time for recent notes
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      // Show date and time for older notes
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
    }
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
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
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
                if (editor) {
                  editor.chain().focus().undo().run();
                }
              }}
              disabled={editor && !editor.can().undo()}
              className="text-text-primary hover:text-text-secondary transition-colors disabled:opacity-50"
              title="Undo"
              aria-label="Undo"
            >
              ↶
            </button>
            <button
              onClick={() => {
                if (editor) {
                  editor.chain().focus().redo().run();
                }
              }}
              disabled={editor && !editor.can().redo()}
              className="text-text-primary hover:text-text-secondary transition-colors disabled:opacity-50"
              title="Redo"
              aria-label="Redo"
            >
              ↷
            </button>
            {isSaving && (
              <span className="text-xs text-text-secondary">
                {isOnline ? 'Saving to cloud...' : 'Saving locally...'}
              </span>
            )}
            {lastSaved && !isSaving && (
              <span className="text-xs text-text-secondary">
                {isOnline && isSavedToCloud 
                  ? `Saved to cloud ${lastSaved.toLocaleTimeString()}`
                  : isOnline
                  ? `Saved locally ${lastSaved.toLocaleTimeString()}`
                  : `Saved offline ${lastSaved.toLocaleTimeString()}`}
              </span>
            )}
            {!isOnline && (
              <span className="text-xs text-red-400 ml-2">⚠️ Offline</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleCreateNote}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors font-semibold"
              title="Create New Note"
              aria-label="Create New Note"
            >
              +
            </button>
            <button
              onClick={async () => {
                if (!note) return;
                
                const textToShare = `${note.title || 'Untitled Note'}\n\n${plainText || ''}`;
                
                // Try Web Share API first, but always fall back to clipboard
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: note.title || 'Untitled Note',
                      text: plainText || '',
                    });
                    return; // Success, exit early
                  } catch (err: any) {
                    // If user cancelled (AbortError), don't show error
                    if (err.name === 'AbortError') {
                      return;
                    }
                    // For other errors, fall through to clipboard
                  }
                }
                
                // Fallback: copy to clipboard
                try {
                  await navigator.clipboard.writeText(textToShare);
                  alert('Note copied to clipboard!');
                } catch (err) {
                  alert('Failed to copy note. Please try again.');
                }
              }}
              className="text-text-primary hover:text-text-secondary transition-colors"
              title="Share"
              aria-label="Share"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <path d="M12 8v8M8 12l4-4 4 4"/>
              </svg>
            </button>
            <button
              onClick={() => {
                setShowFind(!showFind);
                if (showFind) {
                  setFindQuery('');
                }
              }}
              className="text-text-primary hover:text-text-secondary transition-colors"
              title="Find"
              aria-label="Find"
            >
              🔍
            </button>
            {note.tabId && note.tabId !== 'staple' && (
              <button
                onClick={handleDelete}
                className="text-red-500 hover:text-red-600 transition-colors"
                title="Delete Note"
                aria-label="Delete Note"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
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
            <div className="flex items-center gap-3">
              <h1 
                className="text-2xl font-bold cursor-pointer hover:text-text-secondary"
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit title"
              >
                {note.title || 'Untitled Note'}
              </h1>
              <span className="text-sm text-text-secondary">
                • {formatDate(note.updatedAt)}
              </span>
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
                  editor.commands.unsetHighlight();
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
                    editor.commands.unsetHighlight();
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
                  editor.commands.unsetHighlight();
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
    </div>
  );
}

