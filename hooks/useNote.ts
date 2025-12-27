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
  // CRITICAL: Store initial content separately and NEVER update it from note changes
  // This prevents the content prop from changing when note updates, which causes loops
  const initialContentRef = useRef<string>(effectiveInitialNote?.content || '');
  const content = initialContentRef.current;
  // plainText is computed from note when needed, not stored as state to prevent re-render loops
  const plainText = note?.contentPlain || '';
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<any>(null);
  const noteRef = useRef<Note | null>(effectiveInitialNote);
  
  // Track previous noteId to prevent unnecessary updates
  const prevNoteIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const lastProcessedContentRef = useRef<string>('');
  const isProcessingRef = useRef(false);

  // Update note ONLY when noteId changes (switching notes)
  // This prevents infinite loops from cache updates or initialNote object changes
  useEffect(() => {
    // Only update when noteId actually changes (switching notes)
    if (prevNoteIdRef.current !== noteId) {
      prevNoteIdRef.current = noteId;
      isInitializedRef.current = false;
      
        const effectiveNote = cachedNote || initialNote;
        if (effectiveNote && effectiveNote.id === noteId) {
          const newContent = effectiveNote.content || '';
          const newPlainText = effectiveNote.contentPlain || '';
          
          // CRITICAL: Update initial content ref ONLY when switching notes
          // This ensures content prop is stable and doesn't change during saves
          initialContentRef.current = newContent;
          
          // CRITICAL: Use functional update to prevent unnecessary re-renders
          // Only update if note actually changed
          setNote(prevNote => {
            if (prevNote?.id === effectiveNote.id && 
                prevNote?.content === effectiveNote.content &&
                prevNote?.title === effectiveNote.title) {
              return prevNote; // Return same reference to prevent re-render
            }
            return effectiveNote;
          });
          noteRef.current = effectiveNote;
          // Don't call setContent - it causes re-renders that trigger loops
          // Content is managed by the editor itself
          lastProcessedContentRef.current = newContent;
          isInitializedRef.current = true;
        }
    }
  }, [noteId]); // ONLY depend on noteId - ignore initialNote and cachedNote changes

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

    // Don't call setContent - it causes re-renders that trigger loops
    // Content is managed by the editor itself

    const updatedNote: Note = {
      ...note,
      content: currentContent,
      contentPlain: currentPlainText,
      updatedAt: new Date(),
    };
    // CRITICAL: Don't call setNote here - it causes content prop to change, triggering editor re-render
    // Only update noteRef for internal use - setNote will be called only if title changes
    noteRef.current = updatedNote;

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
            // CRITICAL: Only call setNote if title actually changed to prevent re-renders
            setNote(prevNote => {
              if (prevNote && prevNote.title === finalTitle) {
                return prevNote; // Return same reference to prevent re-render
              }
              return updatedNoteWithTitle;
            });
            noteRef.current = updatedNoteWithTitle;
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
      // CRITICAL: Don't process if noteId is empty or note is not initialized
      // This prevents loops during initialization
      if (!noteId || !note || !editorRef.current) {
        return;
      }
      
      // Prevent processing if already processing or content hasn't changed
      if (isProcessingRef.current) {
        return;
      }
      
      // Skip if content is the same as last processed (prevent loops)
      if (newContent === lastProcessedContentRef.current) {
        return;
      }
      
      // Don't process if note hasn't been initialized yet
      if (!isInitializedRef.current) {
        return;
      }
      
      isProcessingRef.current = true;
      lastProcessedContentRef.current = newContent;
      
      // DON'T call setContent or setPlainText here - they cause re-renders that trigger loops
      // The content is already in the editor, we just need to update note state
      // We'll compute plainText from newPlainText when needed

      if (!note || !editorRef.current) {
        isProcessingRef.current = false;
        return;
      }
      
      // Use noteRef to get latest note without causing re-renders
      const currentNote = noteRef.current || note;

      // Auto-generate title from first line if needed
      let title = currentNote.title;
      const firstLine = newPlainText.split('\n')[0].trim();
      const shouldUpdateTitle = !currentNote.title || currentNote.title === firstLine.substring(0, 50);
      
      if (shouldUpdateTitle && firstLine.length > 0) {
        title = firstLine.substring(0, 50);
      } else if (!title || title === 'Untitled Note' || title.trim() === '') {
        // Use temporary title - will be replaced with unique one in async save
        title = 'New Note';
      }

      // Update note state with new title
      // Use noteRef to avoid triggering re-renders during typing
      const updatedNote: Note = {
        ...currentNote,
        title,
        content: newContent,
        contentPlain: newPlainText,
        updatedAt: new Date(),
      };
      
      // DON'T call setNote here - it causes re-renders that trigger the loop
      // Only update noteRef for internal use during typing
      // setNote will be called after successful cloud save
      noteRef.current = updatedNote;

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
        // Check if content changed while we were waiting (skip if stale)
        const currentEditorContent = editorRef.current?.getHTML() || '';
        if (currentEditorContent !== newContent) {
          // Content changed during debounce, skip this save (new one will be queued)
          isProcessingRef.current = false;
          return;
        }
        
        setIsSaving(true);
        // Dispatch sync start event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('note-syncing'));
        }
        
        let finalTitle = title;
        try {
          // Ensure title is unique if empty or default
          if (!finalTitle || finalTitle.trim() === '' || finalTitle === 'Untitled Note') {
            if (currentNote.notebookId && currentNote.userId) {
              finalTitle = await generateUniqueNoteTitle('New Note', currentNote.notebookId, currentNote.userId, noteId);
              // Update noteRef with unique title (don't call setNote to prevent re-render)
              const updatedNoteWithTitle: Note = {
                ...updatedNote,
                title: finalTitle,
              };
              noteRef.current = updatedNoteWithTitle;
              saveNoteLocally(updatedNoteWithTitle);
            } else {
              finalTitle = 'New Note';
            }
          }

          // Always include notebookId in update to ensure it's correct
          // This fixes notes that might have wrong notebookId from old data
          await updateNote(noteId, {
            content: newContent,
            contentPlain: newPlainText,
            title: finalTitle,
            notebookId: currentNote.notebookId, // Ensure notebookId is correct
          });
          
          // Update note state AFTER successful cloud save (not during typing)
          const savedNote: Note = {
            ...updatedNote,
            title: finalTitle,
          };
          noteRef.current = savedNote;
          
          // CRITICAL: Only call setNote if title changed - prevents re-render loops
          // If title didn't change, just update noteRef to avoid triggering re-renders
          // Use functional update to ensure we have the latest state
          if (finalTitle !== currentNote.title) {
            setNote(prevNote => {
              // Only update if title actually changed to prevent unnecessary re-renders
              if (prevNote && prevNote.title === finalTitle) {
                return prevNote; // Return same reference to prevent re-render
              }
              return savedNote;
            });
          } else {
            // Even if title didn't change, update noteRef with latest content
            noteRef.current = savedNote;
          }
          
          // TEMPORARILY DISABLED: Update cache after successful cloud save
          // This was causing re-renders that triggered the loop
          // TODO: Re-enable with proper guards
          // updateCache(savedNote);
          
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
          isProcessingRef.current = false;
        }
      }, 3000); // Increased debounce to 3 seconds to prevent loops
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
    setEditor,
    saveNote,
    handleContentChange,
    handleTitleChange,
  };
}

