import { useState, useCallback, useRef, useEffect } from 'react';
import { Note } from '@/lib/types';
import { updateNote } from '@/lib/firebase/firestore';
import { saveNoteLocally, addToSyncQueue } from '@/lib/utils/localStorage';
import { useNoteCache } from '@/hooks/useNoteCache';

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
      try {
        await updateNote(noteId, {
          content: currentContent,
          contentPlain: currentPlainText,
          title: note.title,
        });
        onSaveComplete?.();
      } catch (error) {
        console.error('Error saving note:', error);
        // Add to sync queue for retry
        addToSyncQueue(noteId, {
          content: currentContent,
          contentPlain: currentPlainText,
          title: note.title,
        });
      } finally {
        setIsSaving(false);
      }
    };

    if (forceImmediate) {
      await performSave();
    } else {
      // Debounce cloud sync (2.5 seconds)
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
      const firstLine = newPlainText.split('\n')[0].trim();
      const shouldUpdateTitle = !note.title || note.title === firstLine.substring(0, 50);
      const title = shouldUpdateTitle && firstLine.length > 0 
        ? firstLine.substring(0, 50) 
        : note.title;

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
      updateCache(updatedNote);

      // Use the unified saveNote function (debounced)
      // Clear any pending saves first
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // Debounce cloud sync using saveNote logic
      saveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          await updateNote(noteId, {
            content: newContent,
            contentPlain: newPlainText,
            title,
          });
          onSaveComplete?.();
        } catch (error) {
          console.error('Error syncing note:', error);
          addToSyncQueue(noteId, {
            content: newContent,
            contentPlain: newPlainText,
            title,
          });
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

    const updatedNote: Note = {
      ...note,
      title: newTitle || 'Untitled Note',
      updatedAt: new Date(),
    };
    setNote(updatedNote);

    try {
      await updateNote(noteId, {
        title: newTitle || 'Untitled Note',
      });
      onSaveComplete?.();
    } catch (error) {
      console.error('Error updating title:', error);
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

  // Save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (note && editorRef.current) {
        const currentContent = editorRef.current.getHTML();
        const currentPlainText = editorRef.current.getText();
        updateNote(noteId, {
          content: currentContent,
          contentPlain: currentPlainText,
          title: note.title,
        }).catch(() => {
          // Ignore errors on unload
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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

