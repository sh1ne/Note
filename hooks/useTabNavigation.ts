import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tab } from '@/lib/types';
import { ensureStapleNoteExists, isStapleNoteTab, isSpecialTab } from '@/lib/utils/noteHelpers';
import { getNotes } from '@/lib/firebase/firestore';
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
    
    // Staple tabs (Scratch, Now, etc.) - open the note directly using slug
    if (isStapleNoteTab(tab)) {
      const stapleNote = await ensureStapleNoteExists(tab.name, notebookId, userId);
      if (stapleNote) {
        const slug = createSlug(stapleNote.title);
        router.push(`/${notebookSlug}/${slug}`);
        return 'redirect';
      }
      return 'stay';
    }
    
    // Regular note tabs - open the first note in that tab using slug
    if (!options?.skipRedirect) {
      try {
        const notesData = await getNotes(notebookId, tab.id, userId);
        if (notesData.length > 0) {
          const noteSlug = createSlug(notesData[0].title);
          router.push(`/${notebookSlug}/${noteSlug}`);
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
