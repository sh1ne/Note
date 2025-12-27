import { useState, useCallback, useRef, useEffect } from 'react';
import { Note } from '@/lib/types';
import { updateNote } from '@/lib/firebase/firestore';
import { saveNoteLocally, addToSyncQueue } from '@/lib/utils/localStorage';
import { useNoteCache } from '@/hooks/useNoteCache';
import { generateUniqueNoteTitle } from '@/lib/utils/noteHelpers';

interface UseNoteOptions {
  noteId: string;
  initialNote: Note | null;
  onSaveComplete?: () => void;
}

export function useNote({ noteId, initialNote, onSaveComplete }: UseNoteOptions) {
  const { cachedNote, updateCache } = useNoteCache(noteId);
  
  // Use cached note if available, otherwise use initialNote
  const effectiveInitialNote = cachedNote || initialNote;
  
  const [note, setNote] = useState<Note | null>(effectiveInitialNote);
  const [content, setContent] = useState(effectiveInitialNote?.content || '');
  const [plainText, setPlainText] = useState(effectiveInitialNote?.contentPlain || '');
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<any>(null);

  // Update note when initialNote or cachedNote changes (when switching notes)
  useEffect(() => {
    const effectiveNote = cachedNote || initialNote;
    if (effectiveNote && effectiveNote.id === noteId) {
      setNote(effectiveNote);
      setContent(effectiveNote.content || '');
      setPlainText(effectiveNote.contentPlain || '');
    }
  }, [initialNote, cachedNote, noteId]);

  // Set editor reference
  const setEditor = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  // Unified save function
  const saveNote = useCallback(async (forceImmediate = false) => {
    if (!note || !editorRef.current) return;

    // Clear any pending saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const currentContent = editorRef.current.getHTML();
    const currentPlainText = editorRef.current.getText();

    // Update local state
    setContent(currentContent);
    setPlainText(currentPlainText);

    const updatedNote: Note = {
      ...note,
      content: currentContent,
      contentPlain: currentPlainText,
      updatedAt: new Date(),
    };
    setNote(updatedNote);

    // Save locally immediately
    saveNoteLocally(updatedNote);

    // Save to cloud
    const performSave = async () => {
      setIsSaving(true);
      // Dispatch sync start event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('note-syncing'));
      }
      try {
        // Ensure title is unique if empty or default
        let finalTitle = note.title;
        if (!finalTitle || finalTitle.trim() === '' || finalTitle === 'Untitled Note') {
          if (note.notebookId && note.userId) {
            finalTitle = await generateUniqueNoteTitle('New Note', note.notebookId, note.userId, noteId);
            // Update note state with unique title
            const updatedNoteWithTitle: Note = {
              ...updatedNote,
              title: finalTitle,
            };
            setNote(updatedNoteWithTitle);
            saveNoteLocally(updatedNoteWithTitle);
          } else {
            finalTitle = 'New Note';
          }
        }

        // Always include notebookId in update to ensure it's correct
        await updateNote(noteId, {
          content: currentContent,
          contentPlain: currentPlainText,
          title: finalTitle,
          notebookId: note.notebookId, // Ensure notebookId is correct
        });
        // Trigger sync event for UI update - this means it successfully synced to cloud
        if (typeof window !== 'undefined') {
          const now = Date.now();
          localStorage.setItem('lastSyncTime', now.toString());
          window.dispatchEvent(new Event('note-synced'));
        }
        onSaveComplete?.();
      } catch (error) {
        console.error('Error saving note:', error);
        // Add to sync queue for retry - this means it failed to sync
        addToSyncQueue(noteId, {
          content: currentContent,
          contentPlain: currentPlainText,
          title: note.title,
        });
        // Dispatch sync error event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('note-sync-error', { 
            detail: { noteId, error } 
          }));
        }
      } finally {
        setIsSaving(false);
      }
    };

    if (forceImmediate) {
      await performSave();
    } else {
      // Debounce cloud sync (2.5 seconds) - but ensure we capture all content
      // Clear any existing timeout first
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(performSave, 2500);
    }
  }, [note, noteId, onSaveComplete]);

  // Handle content change - delegates to saveNote for consistency
  const handleContentChange = useCallback(
    (newContent: string, newPlainText: string) => {
      setContent(newContent);
      setPlainText(newPlainText);

      if (!note || !editorRef.current) return;

      // Auto-generate title from first line if needed
      let title = note.title;
      const firstLine = newPlainText.split('\n')[0].trim();
      const shouldUpdateTitle = !note.title || note.title === firstLine.substring(0, 50);
      
      if (shouldUpdateTitle && firstLine.length > 0) {
        title = firstLine.substring(0, 50);
      } else if (!title || title === 'Untitled Note' || title.trim() === '') {
        // Use temporary title - will be replaced with unique one in async save
        title = 'New Note';
      }

      // Update note state with new title
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
      // Don't call updateCache here - it causes infinite loop
      // Cache will be updated after successful cloud save

      // Use the unified saveNote function (debounced)
      // Clear any pending saves first
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // Debounce cloud sync using saveNote logic
      saveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        // Dispatch sync start event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('note-syncing'));
        }
        
        let finalTitle = title;
        try {
          // Ensure title is unique if empty or default
          if (!finalTitle || finalTitle.trim() === '' || finalTitle === 'Untitled Note') {
            if (note.notebookId && note.userId) {
              finalTitle = await generateUniqueNoteTitle('New Note', note.notebookId, note.userId, noteId);
              // Update note state with unique title
              const updatedNoteWithTitle: Note = {
                ...updatedNote,
                title: finalTitle,
              };
              setNote(updatedNoteWithTitle);
              saveNoteLocally(updatedNoteWithTitle);
            } else {
              finalTitle = 'New Note';
            }
          }

          console.log('[useNote] Calling updateNote for:', {
            noteId,
            title: finalTitle,
            contentLength: newContent.length,
            timestamp: new Date().toISOString(),
          });
          
          // Always include notebookId in update to ensure it's correct
          // This fixes notes that might have wrong notebookId from old data
          await updateNote(noteId, {
            content: newContent,
            contentPlain: newPlainText,
            title: finalTitle,
            notebookId: note.notebookId, // Ensure notebookId is correct
          });
          
          console.log('[useNote] ✅ updateNote completed successfully');
          
          // Trigger sync event for UI update - successfully synced to cloud
          if (typeof window !== 'undefined') {
            const now = Date.now();
            localStorage.setItem('lastSyncTime', now.toString());
            window.dispatchEvent(new Event('note-synced'));
          }
          onSaveComplete?.();
        } catch (error) {
          console.error('Error syncing note:', error);
          addToSyncQueue(noteId, {
            content: newContent,
            contentPlain: newPlainText,
            title: finalTitle || title,
          });
          // Dispatch sync error event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('note-sync-error', { 
              detail: { noteId, error } 
            }));
          }
        } finally {
          setIsSaving(false);
        }
      }, 2500);
    },
    [note, noteId, onSaveComplete]
  );

  // Handle title change
  const handleTitleChange = useCallback(async (newTitle: string) => {
    if (!note) return;

    // If title is empty or default, generate a unique one
    let finalTitle = newTitle.trim();
    if (!finalTitle || finalTitle === 'Untitled Note') {
      if (note.notebookId && note.userId) {
        finalTitle = await generateUniqueNoteTitle('New Note', note.notebookId, note.userId, noteId);
      } else {
        finalTitle = 'New Note';
      }
    }

    const updatedNote: Note = {
      ...note,
      title: finalTitle,
      updatedAt: new Date(),
    };
    setNote(updatedNote);

    try {
      await updateNote(noteId, {
        title: finalTitle,
      });
      // Update sync time when title is synced
      if (typeof window !== 'undefined') {
        const now = Date.now();
        localStorage.setItem('lastSyncTime', now.toString());
        window.dispatchEvent(new Event('note-synced'));
      }
      onSaveComplete?.();
    } catch (error) {
      console.error('Error updating title:', error);
      // Add to sync queue if title update fails
      addToSyncQueue(noteId, {
        title: finalTitle,
      });
    }
  }, [note, noteId, onSaveComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save on beforeunload and visibilitychange (app going to background)
  useEffect(() => {
    const saveBeforeClose = async () => {
      if (note && editorRef.current) {
        const currentContent = editorRef.current.getHTML();
        const currentPlainText = editorRef.current.getText();
        try {
          // Save locally first (instant)
          const updatedNote: Note = {
            ...note,
            content: currentContent,
            contentPlain: currentPlainText,
            updatedAt: new Date(),
          };
          saveNoteLocally(updatedNote);
          
          // Try to sync to cloud (fire and forget - don't wait)
        updateNote(noteId, {
          content: currentContent,
          contentPlain: currentPlainText,
          title: note.title,
        }).catch(() => {
            // If sync fails, add to queue
            addToSyncQueue(noteId, {
              content: currentContent,
              contentPlain: currentPlainText,
              title: note.title,
            });
          });
        } catch (error) {
          // Ignore errors on unload - data is saved locally
        }
      }
    };

    const handleBeforeUnload = () => {
      saveBeforeClose();
    };

    const handleVisibilityChange = () => {
      // When app goes to background (mobile) or tab becomes hidden
      if (document.visibilityState === 'hidden') {
        saveBeforeClose();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [note, noteId]);

  return {
    note,
    content,
    plainText,
    isSaving,
    setNote,
    setContent,
    setPlainText,
    setEditor,
    saveNote,
    handleContentChange,
    handleTitleChange,
  };
}

