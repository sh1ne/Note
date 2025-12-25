import { Note, Tab } from '@/lib/types';
import { getNotes, createNote } from '@/lib/firebase/firestore';

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

