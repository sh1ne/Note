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
    const allNotes = await getNotes(notebookId, undefined, userId);
    let stapleNote = allNotes.find((n) => n.title === stapleName && n.tabId === 'staple');
    
    if (!stapleNote) {
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
    
    return stapleNote;
  } catch (error) {
    console.error(`Error ensuring staple note ${stapleName} exists:`, error);
    return null;
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
    const allNotes = await getNotes(notebookId, undefined, userId);
    const existingTitles = allNotes
      .filter((n) => !n.deletedAt && (!excludeNoteId || n.id !== excludeNoteId))
      .map((n) => n.title.trim().toLowerCase());
    
    // If baseTitle is "New Note", use "Note" instead
    const actualBaseTitle = baseTitle === 'New Note' ? 'Note' : baseTitle;
    
    let uniqueTitle = actualBaseTitle;
    let counter = 1;
    
    while (existingTitles.includes(uniqueTitle.trim().toLowerCase())) {
      uniqueTitle = `${actualBaseTitle}${counter}`;
      counter++;
    }
    
    return uniqueTitle;
  } catch (error) {
    console.error('Error generating unique note title:', error);
    return baseTitle === 'New Note' ? 'Note' : baseTitle; // Fallback to base title if error
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
    // First check if it's a staple note slug
    if (isStapleNoteSlug(noteSlug)) {
      return await getStapleNoteBySlug(noteSlug, notebookId, userId);
    }
    
    // Otherwise, search all notes in the notebook
    const allNotes = await getNotes(notebookId, undefined, userId);
    
    // Find note by matching slug of title
    for (const note of allNotes) {
      const noteSlugFromTitle = createSlug(note.title);
      if (noteSlugFromTitle === noteSlug) {
        return note;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting note by slug ${noteSlug}:`, error);
    return null;
  }
}

