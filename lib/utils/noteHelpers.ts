import { Note, Tab } from '@/lib/types';
import { getNotes, createNote } from '@/lib/firebase/firestore';
import { createSlug } from './slug';

/**
 * Ensures a staple note exists for the given tab name
 */
export async function ensureStapleNoteExists(
  stapleName: string,
  notebookId: string,
  userId: string
): Promise<Note | null> {
  try {
    const isOffline = typeof window !== 'undefined' && !navigator.onLine;
    
    let allNotes: Note[];
    if (isOffline) {
      // Load from local cache when offline
      const { getAllNotesLocally } = await import('@/lib/utils/localStorage');
      const allLocalNotes = await getAllNotesLocally();
      allNotes = allLocalNotes.filter((n) => n.notebookId === notebookId && n.userId === userId);
    } else {
      allNotes = await getNotes(notebookId, undefined, userId);
    }
    
    let stapleNote = allNotes.find((n) => n.title === stapleName && n.tabId === 'staple');
    
    if (!stapleNote) {
      if (isOffline) {
        // Create locally when offline
        const { saveNoteLocally, addToSyncQueue } = await import('@/lib/utils/localStorage');
        const tempNoteId = `temp-staple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        stapleNote = {
          id: tempNoteId,
          userId,
          notebookId,
          tabId: 'staple',
          title: stapleName,
          content: '',
          contentPlain: '',
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          deletedAt: null,
        } as Note;
        
        await saveNoteLocally(stapleNote);
        await addToSyncQueue(tempNoteId, {
          title: stapleName,
          content: '',
          contentPlain: '',
          images: [],
          notebookId,
          tabId: 'staple',
        });
      } else {
        const noteId = await createNote({
          userId,
          notebookId,
          tabId: 'staple',
          title: stapleName,
          content: '',
          contentPlain: '',
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          deletedAt: null,
        });
        
        stapleNote = {
          id: noteId,
          userId,
          notebookId,
          tabId: 'staple',
          title: stapleName,
          content: '',
          contentPlain: '',
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          deletedAt: null,
        } as Note;
      }
    }
    
    return stapleNote;
  } catch (error) {
    console.error(`Error ensuring staple note ${stapleName} exists:`, error);
    // Try to load from local cache as fallback
    try {
      const { getAllNotesLocally } = await import('@/lib/utils/localStorage');
      const allLocalNotes = await getAllNotesLocally();
      const stapleNote = allLocalNotes.find(
        (n) => n.title === stapleName && n.tabId === 'staple' && n.notebookId === notebookId && n.userId === userId
      );
      return stapleNote || null;
    } catch (cacheError) {
      return null;
    }
  }
}

/**
 * Finds the tab associated with a note
 */
export function findNoteTab(note: Note, tabs: Tab[]): Tab | undefined {
  // Check by tabId first (more reliable)
  if (note.tabId && note.tabId !== 'staple') {
    return tabs.find((t) => t.id === note.tabId);
  }
  
  // For staple notes, find by title
  if (note.tabId === 'staple') {
    return tabs.find((t) => t.name === note.title && t.isStaple);
  }
  
  return undefined;
}

/**
 * Checks if a tab is a staple tab (excluding All Notes and More)
 */
export function isStapleNoteTab(tab: Tab): boolean {
  return tab.isStaple && tab.name !== 'All Notes' && tab.name !== 'More';
}

/**
 * Checks if a tab is a special tab (All Notes or More)
 */
export function isSpecialTab(tab: Tab): boolean {
  return tab.name === 'All Notes' || tab.name === 'More';
}

/**
 * Get staple note by slug (e.g., "scratch", "now", "short-term", "long-term")
 */
export async function getStapleNoteBySlug(
  slug: string,
  notebookId: string,
  userId: string
): Promise<Note | null> {
  try {
    const allNotes = await getNotes(notebookId, undefined, userId);
    const stapleNotes = allNotes.filter((n) => n.tabId === 'staple');
    
    // Map of known staple note slugs to their titles
    const stapleSlugMap: Record<string, string> = {
      'scratch': 'Scratch',
      'now': 'Now',
      'short-term': 'Short-Term',
      'long-term': 'Long-term',
    };
    
    const title = stapleSlugMap[slug];
    if (title) {
      return stapleNotes.find((n) => n.title === title) || null;
    }
    
    // Fallback: try to find by matching slug of title
    return stapleNotes.find((n) => createSlug(n.title) === slug) || null;
  } catch (error) {
    console.error(`Error getting staple note by slug ${slug}:`, error);
    return null;
  }
}

/**
 * Check if a string is a staple note slug
 */
export function isStapleNoteSlug(slug: string): boolean {
  const stapleSlugs = ['scratch', 'now', 'short-term', 'long-term'];
  return stapleSlugs.includes(slug.toLowerCase());
}

/**
 * Generate a unique note title by checking existing notes
 */
export async function generateUniqueNoteTitle(
  baseTitle: string,
  notebookId: string,
  userId: string,
  excludeNoteId?: string
): Promise<string> {
  try {
    const isOffline = typeof window !== 'undefined' && !navigator.onLine;
    
    let allNotes: Note[];
    if (isOffline) {
      // Load from local cache when offline
      const { getAllNotesLocally } = await import('@/lib/utils/localStorage');
      const allLocalNotes = await getAllNotesLocally();
      allNotes = allLocalNotes.filter((n) => n.notebookId === notebookId && n.userId === userId);
    } else {
      allNotes = await getNotes(notebookId, undefined, userId);
    }
    
    const existingTitles = allNotes
      .filter((n) => !n.deletedAt && (!excludeNoteId || n.id !== excludeNoteId))
      .map((n) => n.title.trim().toLowerCase());
    
    // If baseTitle is "New Note", use "Note" instead
    const effectiveBaseTitle = baseTitle === 'New Note' ? 'Note' : baseTitle;
    
    let uniqueTitle = effectiveBaseTitle;
    let counter = 1;
    
    // If the base title itself exists, start numbering from 1
    if (existingTitles.includes(uniqueTitle.trim().toLowerCase())) {
      uniqueTitle = `${effectiveBaseTitle}${counter}`;
      counter++;
    }
    
    while (existingTitles.includes(uniqueTitle.trim().toLowerCase())) {
      uniqueTitle = `${effectiveBaseTitle}${counter}`;
      counter++;
    }
    
    return uniqueTitle;
  } catch (error) {
    console.error('Error generating unique note title:', error);
    // Try local cache as fallback
    try {
      const { getAllNotesLocally } = await import('@/lib/utils/localStorage');
      const allLocalNotes = await getAllNotesLocally();
      const allNotes = allLocalNotes.filter((n) => n.notebookId === notebookId && n.userId === userId);
      const existingTitles = allNotes
        .filter((n) => !n.deletedAt)
        .map((n) => n.title.trim().toLowerCase());
      
      const effectiveBaseTitle = baseTitle === 'New Note' ? 'Note' : baseTitle;
      let uniqueTitle = effectiveBaseTitle;
      let counter = 1;
      
      if (existingTitles.includes(uniqueTitle.trim().toLowerCase())) {
        uniqueTitle = `${effectiveBaseTitle}${counter}`;
        counter++;
      }
      
      while (existingTitles.includes(uniqueTitle.trim().toLowerCase())) {
        uniqueTitle = `${effectiveBaseTitle}${counter}`;
        counter++;
      }
      
      return uniqueTitle;
    } catch (cacheError) {
      return baseTitle === 'New Note' ? 'Note' : baseTitle; // Fallback to base title if error
    }
  }
}

/**
 * Get note by slug (for regular notes and staple notes)
 */
export async function getNoteBySlug(
  noteSlug: string,
  notebookId: string,
  userId: string
): Promise<Note | null> {
  try {
    const isOffline = typeof window !== 'undefined' && !navigator.onLine;
    
    // First check if it's a staple note slug
    if (isStapleNoteSlug(noteSlug)) {
      return await getStapleNoteBySlug(noteSlug, notebookId, userId);
    }
    
    // Otherwise, search all notes in the notebook
    let allNotes: Note[];
    if (isOffline) {
      // Load from local cache when offline
      const { getAllNotesLocally } = await import('@/lib/utils/localStorage');
      const allLocalNotes = await getAllNotesLocally();
      allNotes = allLocalNotes.filter((n) => n.notebookId === notebookId && n.userId === userId);
    } else {
      allNotes = await getNotes(notebookId, undefined, userId);
    }
    
    // Find all notes matching the slug
    const matchingNotes = allNotes.filter((note) => {
      const noteSlugFromTitle = createSlug(note.title);
      return noteSlugFromTitle === noteSlug;
    });
    
    if (matchingNotes.length === 0) {
      return null;
    }
    
    // If multiple notes match, return the most recently updated one (deterministic)
    // This ensures the same note is always returned across devices
    matchingNotes.sort((a, b) => {
      const aTime = a.updatedAt?.getTime() || 0;
      const bTime = b.updatedAt?.getTime() || 0;
      return bTime - aTime; // Most recent first
    });
    
    return matchingNotes[0];
  } catch (error) {
    console.error(`Error getting note by slug ${noteSlug}:`, error);
    // Try local cache as fallback
    try {
      const { getAllNotesLocally } = await import('@/lib/utils/localStorage');
      const allLocalNotes = await getAllNotesLocally();
      const allNotes = allLocalNotes.filter((n) => n.notebookId === notebookId && n.userId === userId);
      
      if (isStapleNoteSlug(noteSlug)) {
        const stapleSlugMap: Record<string, string> = {
          'scratch': 'Scratch',
          'now': 'Now',
          'short-term': 'Short-Term',
          'long-term': 'Long-term',
        };
        const title = stapleSlugMap[noteSlug];
        if (title) {
          const stapleNote = allNotes.find((n) => n.title === title && n.tabId === 'staple');
          if (stapleNote) return stapleNote;
        }
      }
      
      const matchingNotes = allNotes.filter((note) => {
        const noteSlugFromTitle = createSlug(note.title);
        return noteSlugFromTitle === noteSlug;
      });
      
      if (matchingNotes.length > 0) {
        matchingNotes.sort((a, b) => {
          const aTime = a.updatedAt?.getTime() || 0;
          const bTime = b.updatedAt?.getTime() || 0;
          return bTime - aTime;
        });
        return matchingNotes[0];
      }
    } catch (cacheError) {
      console.error('Error loading from cache:', cacheError);
    }
    return null;
  }
}

