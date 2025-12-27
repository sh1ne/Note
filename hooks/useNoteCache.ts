import { useEffect, useState } from 'react';
import { Note } from '@/lib/types';
import { getNoteLocally, saveNoteLocally } from '@/lib/utils/localStorage';

/**
 * Hook to manage note caching with IndexedDB
 * Loads from cache first, then syncs from Firebase
 */
export function useNoteCache(noteId: string) {
  const [cachedNote, setCachedNote] = useState<Note | null>(null);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true);

  useEffect(() => {
    const loadFromCache = async () => {
      try {
        const cached = await getNoteLocally(noteId);
        if (cached) {
          setCachedNote(cached);
        }
      } catch (error) {
        console.error('Error loading from cache:', error);
      } finally {
        setIsLoadingFromCache(false);
      }
    };

    if (noteId) {
      loadFromCache();
    }
  }, [noteId]);

  const updateCache = async (note: Note) => {
    try {
      await saveNoteLocally(note);
      setCachedNote(note);
    } catch (error) {
      console.error('Error updating cache:', error);
    }
  };

  return {
    cachedNote,
    isLoadingFromCache,
    updateCache,
  };
}

