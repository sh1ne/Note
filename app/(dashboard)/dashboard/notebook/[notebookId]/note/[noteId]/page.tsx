'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { updateNote, deleteNote, getTabs } from '@/lib/firebase/firestore';
import { Note, Tab } from '@/lib/types';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { saveNoteLocally, addToSyncQueue } from '@/lib/utils/localStorage';
import BottomNav from '@/components/layout/BottomNav';

let saveTimeout: NodeJS.Timeout | null = null;

export default function NoteEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const notebookId = params.notebookId as string;
  const noteId = params.noteId as string;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [plainText, setPlainText] = useState('');
  const [editor, setEditor] = useState<any>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  useEffect(() => {
    if (user && noteId) {
      // Clear any pending saves when switching notes
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      loadNote();
      loadTabs();
    }
  }, [user, noteId, notebookId]);

  // Add beforeunload handler to save on page close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (note && editor) {
        // Try to save synchronously if possible
        try {
          const currentContent = editor.getHTML();
          const currentPlainText = editor.getText();
          // Clear timeout to trigger immediate save
          if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
          }
          // Fire and forget - can't await in beforeunload
          updateNote(noteId, {
            content: currentContent,
            contentPlain: currentPlainText,
            title: note.title,
          }).catch(() => {
            // Ignore errors on unload
          });
        } catch (error) {
          // Ignore errors on unload
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [note, editor, noteId]);

  // Save on unmount (when navigating away)
  useEffect(() => {
    return () => {
      // Save any pending changes when component unmounts
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      // Note: We can't reliably access editor in cleanup, so we rely on handleTabClick/handleBack
      // which are called before navigation
    };
  }, [noteId]);

  const loadTabs = async () => {
    try {
      const tabsData = await getTabs(notebookId);
      setTabs(tabsData);
      // Find the tab for this note
      if (note) {
        const noteTab = tabsData.find((t) => t.name === note.title || (note.tabId && t.id === note.tabId));
        if (noteTab) {
          setActiveTabId(noteTab.id);
        }
      }
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  };

  const loadNote = async () => {
    try {
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
        
        // Reset state completely when loading a new note
        setNote(noteData);
        setContent(noteData.content || '');
        setPlainText(noteData.contentPlain || '');
        setTitleValue(noteData.title || '');
        
        // Load tabs after note is loaded
        const tabsData = await getTabs(notebookId);
        setTabs(tabsData);
        // Find the tab for this note - check by tabId first (more reliable), then by title
        let noteTab: Tab | undefined;
        if (noteData.tabId && noteData.tabId !== 'staple') {
          noteTab = tabsData.find((t) => t.id === noteData.tabId);
        }
        if (!noteTab) {
          // For staple notes, find by title
          noteTab = tabsData.find((t) => t.name === noteData.title && t.isStaple);
        }
        if (noteTab) {
          setActiveTabId(noteTab.id);
        }
      }
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = useCallback(
    (newContent: string, newPlainText: string) => {
      setContent(newContent);
      setPlainText(newPlainText);

      if (!note || !user) return;

      // Only auto-generate title if title hasn't been manually edited
      // If title is empty or matches first line, update it
      const firstLine = newPlainText.split('\n')[0].trim();
      const currentTitle = titleValue || note.title || '';
      const shouldUpdateTitle = !currentTitle || currentTitle === note.title || currentTitle === firstLine.substring(0, 50);
      
      const title = shouldUpdateTitle && firstLine.length > 0 
        ? firstLine.substring(0, 50) 
        : (titleValue || note.title || 'Untitled Note');

      // Update note in state - ensure we're updating the actual note object
      const updatedNote: Note = {
        ...note,
        title,
        content: newContent,
        contentPlain: newPlainText,
        updatedAt: new Date(),
      };
      setNote(updatedNote);

      // Save locally immediately
      saveNoteLocally(updatedNote);

      // Debounce cloud sync (2-3 seconds)
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      saveTimeout = setTimeout(async () => {
        try {
          await updateNote(noteId, {
            content: newContent,
            contentPlain: newPlainText,
            title,
          });
          
          // Update tab name immediately if it's not a staple note
          if (note.tabId && note.tabId !== 'staple') {
            const { updateTab } = await import('@/lib/firebase/firestore');
            await updateTab(note.tabId, { name: title || 'Untitled Note' });
            // Reload tabs immediately to show updated name
            await loadTabs();
          }
        } catch (error) {
          // If offline or error, add to sync queue
          console.error('Error syncing note:', error);
          addToSyncQueue(noteId, {
            content: newContent,
            contentPlain: newPlainText,
            title,
          });
        }
      }, 2500);
    },
    [note, user, noteId, titleValue]
  );

  const handleTitleChange = async (newTitle: string) => {
    setTitleValue(newTitle);
    if (!note || !user) return;

    const updatedNote = {
      ...note,
      title: newTitle || 'Untitled Note',
      updatedAt: new Date(),
    };
    setNote(updatedNote as Note);

    // Save title immediately
    try {
      await updateNote(noteId, {
        title: newTitle || 'Untitled Note',
      });
      
      // Update tab name if it's not a staple note
      if (note.tabId && note.tabId !== 'staple') {
        const { updateTab } = await import('@/lib/firebase/firestore');
        await updateTab(note.tabId, { name: newTitle || 'Untitled Note' });
        // Reload tabs to show updated name
        await loadTabs();
      }
    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  const handleTabClick = async (tabId: string) => {
    // Save current note before switching - get content directly from editor
    // Use a promise to ensure save completes before navigation
    const savePromise = note && editor ? (async () => {
      // Force immediate save
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      try {
        const currentContent = editor.getHTML();
        const currentPlainText = editor.getText();
        await updateNote(noteId, {
          content: currentContent,
          contentPlain: currentPlainText,
          title: note.title,
        });
        // Update local state
        setContent(currentContent);
        setPlainText(currentPlainText);
      } catch (error) {
        console.error('Error saving before switch:', error);
        throw error; // Re-throw to prevent navigation if save fails
      }
    })() : Promise.resolve();

    // Wait for save to complete before navigating
    await savePromise;

    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.name === 'All Notes') {
      router.push(`/dashboard/notebook/${notebookId}`);
    } else if (tab?.name === 'More') {
      router.push(`/dashboard/notebook/${notebookId}/more`);
    } else if (tab?.isStaple && tab.name !== 'All Notes' && tab.name !== 'More') {
      // Find the staple note - ensure it exists first
      const { getNotes, createNote } = await import('@/lib/firebase/firestore');
      let allNotes = await getNotes(notebookId, undefined, user?.uid);
      let stapleNote = allNotes.find((n) => n.title === tab.name && n.tabId === 'staple');
      
      // Create if doesn't exist
      if (!stapleNote) {
        const newNoteId = await createNote({
          userId: user!.uid,
          notebookId,
          tabId: 'staple',
          title: tab.name,
          content: '',
          contentPlain: '',
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          deletedAt: null,
        });
        stapleNote = {
          id: newNoteId,
          userId: user!.uid,
          notebookId,
          tabId: 'staple',
          title: tab.name,
          content: '',
          contentPlain: '',
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          deletedAt: null,
        } as Note;
      }
      
      if (stapleNote) {
        setActiveTabId(tabId);
        router.push(`/dashboard/notebook/${notebookId}/note/${stapleNote.id}`);
      }
    } else {
      // Regular note tab
      setActiveTabId(tabId);
      const { getNotes } = await import('@/lib/firebase/firestore');
      const notesData = await getNotes(notebookId, tabId, user?.uid);
      if (notesData.length > 0) {
        router.push(`/dashboard/notebook/${notebookId}/note/${notesData[0].id}`);
      }
    }
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

      router.push(`/dashboard/notebook/${notebookId}/note/${newNoteId}`);
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const handleBack = async () => {
    // Save current note before going back - get content directly from editor
    if (note && editor) {
      // Force immediate save
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      try {
        const currentContent = editor.getHTML();
        const currentPlainText = editor.getText();
        await updateNote(noteId, {
          content: currentContent,
          contentPlain: currentPlainText,
          title: note.title,
        });
        // Update local state
        setContent(currentContent);
        setPlainText(currentPlainText);
      } catch (error) {
        console.error('Error saving before back:', error);
      }
    }
    router.back();
  };

  const handleUndo = () => {
    // Handled by editor
  };

  const handleRedo = () => {
    // Handled by editor
  };

  const handleDelete = async () => {
    if (!note) return;
    if (confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteNote(noteId);
        router.back();
      } catch (error) {
        console.error('Error deleting note:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>Loading...</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>Note not found</p>
      </div>
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
    <div className="min-h-screen bg-black text-white pb-16">
      {/* Header Bar */}
      <div className="sticky top-0 bg-black border-b border-gray-800 z-20">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="text-white hover:text-gray-400 transition-colors"
              title="Back"
              aria-label="Back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              className="text-white hover:text-gray-400 transition-colors disabled:opacity-50"
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
              className="text-white hover:text-gray-400 transition-colors disabled:opacity-50"
              title="Redo"
              aria-label="Redo"
            >
              ↷
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                // Share functionality
                alert('Share feature coming soon');
              }}
              className="text-white hover:text-gray-400 transition-colors"
              title="Share"
              aria-label="Share"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <path d="M12 3v9M8 7l4-4 4 4"/>
              </svg>
            </button>
            <button
              onClick={() => {
                // Find functionality
                alert('Find feature coming soon');
              }}
              className="text-white hover:text-gray-400 transition-colors"
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

      {/* Note Title and Date */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={() => {
                setIsEditingTitle(false);
                handleTitleChange(titleValue);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingTitle(false);
                  handleTitleChange(titleValue);
                }
                if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                  setTitleValue(note.title || 'Untitled Note');
                }
              }}
              className="text-2xl font-bold mb-2 bg-transparent border-b-2 border-gray-600 focus:border-white focus:outline-none w-full text-white"
              autoFocus
            />
          ) : (
            <h1 
              className="text-2xl font-bold mb-2 cursor-pointer hover:text-gray-300"
              onClick={() => setIsEditingTitle(true)}
              title="Click to edit title"
            >
              {note.title || 'Untitled Note'}
            </h1>
          )}
          <p className="text-sm text-gray-400">{formatDate(note.updatedAt)}</p>
        </div>
      </div>

      {/* Editor */}
      <div className="max-w-4xl mx-auto">
        <RichTextEditor
          content={content}
          onChange={handleContentChange}
          placeholder="Start writing..."
          onEditorReady={setEditor}
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

