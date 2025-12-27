import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tab } from '@/lib/types';
import { ensureStapleNoteExists, isStapleNoteTab, isSpecialTab } from '@/lib/utils/noteHelpers';
import { getNotes } from '@/lib/firebase/firestore';
import { getAllNotesLocally } from '@/lib/utils/localStorage';
import { createSlug } from '@/lib/utils/slug';

interface UseTabNavigationOptions {
  notebookId: string; // Still need ID for data operations
  notebookSlug: string; // Use slug for URLs
  userId: string;
}

/**
 * Unified navigation state machine for tab clicks
 * Handles all tab navigation logic in one place
 */
export function useTabNavigation({ notebookId, notebookSlug, userId }: UseTabNavigationOptions) {
  const router = useRouter();

  const navigateToTab = useCallback(async (
    tab: Tab,
    options?: { skipRedirect?: boolean }
  ): Promise<'redirect' | 'stay' | 'load-list'> => {
    // Special tabs: "All Notes" and "More"
    if (tab.name === 'All Notes') {
      // Navigate to notebook page with view param for shareable URLs
      router.push(`/${notebookSlug}?view=all-notes`);
      return 'load-list';
    }
    
    if (tab.name === 'More') {
      router.push(`/${notebookSlug}/more`);
      return 'redirect';
    }
    
    // If notebookId is empty, try to get it from cache when offline
    let currentNotebookId = notebookId;
    if (!currentNotebookId) {
      const isOffline = typeof window !== 'undefined' && !navigator.onLine;
      if (isOffline && notebookSlug && userId) {
        try {
          const { getNotebookBySlugLocally } = await import('@/lib/utils/localStorage');
          const cachedNotebook = await getNotebookBySlugLocally(userId, notebookSlug);
          if (cachedNotebook) {
            currentNotebookId = cachedNotebook.id;
            console.log('[navigateToTab] Loaded notebookId from cache:', currentNotebookId);
          }
        } catch (cacheError) {
          console.error('[navigateToTab] Error loading notebook from cache:', cacheError);
        }
      }
      
      // If still no notebookId, we can't proceed
      if (!currentNotebookId) {
        console.error('[navigateToTab] No notebookId available for navigation');
        return 'stay';
      }
    }
    
    // Staple tabs (Scratch, Now, etc.) - open the note directly using slug
    if (isStapleNoteTab(tab)) {
      // Use ensureStapleNoteExists which handles both online and offline cases
      const stapleNote = await ensureStapleNoteExists(tab.name, currentNotebookId, userId);
      if (stapleNote) {
        const slug = createSlug(stapleNote.title);
        const targetUrl = `/${notebookSlug}/${slug}`;
        const isOffline = typeof window !== 'undefined' && !navigator.onLine;
        console.log('[navigateToTab] Client-side navigation to:', targetUrl, 'offline:', isOffline, 'timestamp:', new Date().toISOString());
        console.trace('[navigateToTab] Navigation stack trace');
        // Use router.push() for client-side navigation (no full page reload)
        router.push(targetUrl);
        return 'redirect';
      }
      return 'stay';
    }
    
    // Regular note tabs - open the first note in that tab using slug
    if (!options?.skipRedirect) {
      try {
        const isOffline = typeof window !== 'undefined' && !navigator.onLine;
        
        let notesData;
        if (isOffline) {
          // Load from local cache when offline
          const allLocalNotes = await getAllNotesLocally();
          notesData = allLocalNotes.filter(
            (n) => n.notebookId === currentNotebookId && n.tabId === tab.id && n.userId === userId && !n.deletedAt
          );
          // Sort by updatedAt descending (most recent first)
          notesData.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        } else {
          notesData = await getNotes(currentNotebookId, tab.id, userId);
        }
        
        if (notesData.length > 0) {
          const noteSlug = createSlug(notesData[0].title);
          const targetUrl = `/${notebookSlug}/${noteSlug}`;
          const isOffline = typeof window !== 'undefined' && !navigator.onLine;
          console.log('[navigateToTab] Client-side navigation to:', targetUrl, 'offline:', isOffline, 'timestamp:', new Date().toISOString());
          console.trace('[navigateToTab] Navigation stack trace');
          // Use router.push() for client-side navigation (no full page reload)
          router.push(targetUrl);
          return 'redirect';
        }
      } catch (error) {
        console.error('Error loading note for tab:', error);
      }
    }
    
    return 'stay';
  }, [notebookId, notebookSlug, userId, router]);

  return { navigateToTab };
}
