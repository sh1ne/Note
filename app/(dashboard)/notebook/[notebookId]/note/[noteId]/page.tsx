'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { deleteNote, updateTab } from '@/lib/firebase/firestore';
import { Note } from '@/lib/types';
import RichTextEditor from '@/components/editor/RichTextEditor';
import BottomNav from '@/components/layout/BottomNav';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useNote } from '@/hooks/useNote';
import { useTabs } from '@/hooks/useTabs';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { findNoteTab } from '@/lib/utils/noteHelpers';

export default function NoteEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const notebookId = params.notebookId as string;
  const noteId = params.noteId as string;

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

  // Use custom hooks
  const { tabs, activeTabId, setActiveTabId, getTabById, refreshTabs } = useTabs({ 
    notebookId,
    defaultTabName: 'Scratch'
  });

  const { navigateToTab } = useTabNavigation({
    notebookId,
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
    noteId,
    initialNote,
    onSaveComplete: async () => {
      setLastSaved(new Date());
      // Update tab name if it's not a staple note
      if (note && note.tabId && note.tabId !== 'staple') {
        await updateTab(note.tabId, { name: note.title || 'Untitled Note' });
        await refreshTabs();
      }
    },
  });

  useEffect(() => {
    if (user && noteId) {
      loadNote();
    }
  }, [user, noteId, notebookId]);

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
      const noteRef = doc(db, 'notes', noteId);
      const noteSnap = await getDoc(noteRef);
      if (noteSnap.exists()) {
        const noteData = {
          id: noteSnap.id,
          ...noteSnap.data(),
          createdAt: noteSnap.data().createdAt.toDate(),
          updatedAt: noteSnap.data().updatedAt.toDate(),
          deletedAt: noteSnap.data().deletedAt?.toDate() || null,
        } as Note;
        
        setInitialNote(noteData);
        setTitleValue(noteData.title || '');
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
    const { createNote, createTab } = await import('@/lib/firebase/firestore');
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

      const newNoteId = await createNote({
        userId: user!.uid,
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

      router.push(`/notebook/${notebookId}/note/${newNoteId}`);
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
    try {
      await deleteNote(noteId);
      setShowDeleteConfirm(false);
      router.back();
    } catch (error) {
      console.error('Error deleting note:', error);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
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
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pb-16">
      {/* Header Bar */}
      <div className="sticky top-0 bg-bg-primary border-b border-bg-secondary z-20">
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
              <span className="text-xs text-text-secondary">Saving...</span>
            )}
            {lastSaved && !isSaving && (
              <span className="text-xs text-text-secondary">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={async () => {
                if (navigator.share && note) {
                  try {
                    await navigator.share({
                      title: note.title || 'Untitled Note',
                      text: plainText || '',
                    });
                  } catch (err) {
                    // User cancelled or error
                    console.log('Share cancelled');
                  }
                } else {
                  // Fallback: copy to clipboard
                  const textToShare = `${note?.title || 'Untitled Note'}\n\n${plainText || ''}`;
                  try {
                    await navigator.clipboard.writeText(textToShare);
                    alert('Note copied to clipboard!');
                  } catch (err) {
                    alert('Failed to copy note');
                  }
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
              onChange={(e) => setFindQuery(e.target.value)}
              placeholder="Search in note..."
              className="flex-1 px-3 py-2 bg-bg-primary border border-text-secondary rounded text-text-primary focus:outline-none focus:border-text-primary"
              autoFocus
            />
            <button
              onClick={() => {
                if (editor && findQuery) {
                  // Simple find - scroll to first occurrence
                  const text = editor.getText();
                  const index = text.toLowerCase().indexOf(findQuery.toLowerCase());
                  if (index !== -1) {
                    // TipTap doesn't have built-in find, so we'll just highlight
                    editor.commands.focus();
                  }
                }
              }}
              className="px-4 py-2 bg-bg-primary text-text-primary rounded hover:bg-bg-secondary"
            >
              Find
            </button>
            <button
              onClick={() => {
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

