import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tab } from '@/lib/types';
import { ensureStapleNoteExists, isStapleNoteTab, isSpecialTab } from '@/lib/utils/noteHelpers';
import { getNotes } from '@/lib/firebase/firestore';

interface UseTabNavigationOptions {
  notebookId: string;
  userId: string;
}

/**
 * Unified navigation state machine for tab clicks
 * Handles all tab navigation logic in one place
 */
export function useTabNavigation({ notebookId, userId }: UseTabNavigationOptions) {
  const router = useRouter();

  const navigateToTab = useCallback(async (
    tab: Tab,
    options?: { skipRedirect?: boolean }
  ): Promise<'redirect' | 'stay' | 'load-list'> => {
    // Special tabs: "All Notes" and "More"
    if (tab.name === 'All Notes') {
      // Navigate to notebook page with view param for shareable URLs
      router.push(`/notebook/${notebookId}?view=all-notes`);
      return 'load-list';
    }
    
    if (tab.name === 'More') {
      router.push(`/notebook/${notebookId}/more`);
      return 'redirect';
    }
    
    // Staple tabs (Scratch, Now, etc.) - open the note directly
    if (isStapleNoteTab(tab)) {
      const stapleNote = await ensureStapleNoteExists(tab.name, notebookId, userId);
      if (stapleNote) {
        router.push(`/notebook/${notebookId}/note/${stapleNote.id}`);
        return 'redirect';
      }
      return 'stay';
    }
    
    // Regular note tabs - open the first note in that tab
    if (!options?.skipRedirect) {
      try {
        const notesData = await getNotes(notebookId, tab.id, userId);
        if (notesData.length > 0) {
          router.push(`/notebook/${notebookId}/note/${notesData[0].id}`);
          return 'redirect';
        }
      } catch (error) {
        console.error('Error loading note for tab:', error);
      }
    }
    
    return 'stay';
  }, [notebookId, userId, router]);

  return { navigateToTab };
}

