import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';

// Retry helper for Firestore operations
const retryFirestoreOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Don't call enableNetwork here - it's handled in config.ts to prevent duplicate calls
      return await operation();
    } catch (error: any) {
      lastError = error;
      // If it's an offline error, wait and retry
      if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          continue;
        }
      }
      // For other errors, throw immediately
      throw error;
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
};

import { Notebook, Tab, Note, UserPreferences } from '../types';
import { createSlug, ensureUniqueSlug } from '../utils/slug';

// Notebooks
export const createNotebook = async (notebook: Omit<Notebook, 'id' | 'slug'> & { name: string; userId: string }) => {
  if (typeof window === 'undefined') {
    throw new Error('Firestore can only be used in browser');
  }
  
  // Generate unique slug
  const baseSlug = createSlug(notebook.name);
  const existingNotebooks = await getNotebooks(notebook.userId);
  const existingSlugs = existingNotebooks.map(nb => nb.slug || '');
  const uniqueSlug = ensureUniqueSlug(baseSlug, existingSlugs);
  
  const notebookRef = doc(collection(db, 'notebooks'));
  const notebookData = {
    ...notebook,
    slug: uniqueSlug,
    id: notebookRef.id,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  await setDoc(notebookRef, notebookData);
  return notebookRef.id;
};

export const getNotebooks = async (userId: string): Promise<Notebook[]> => {
  return retryFirestoreOperation(async () => {
    const q = query(
      collection(db, 'notebooks'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const notebooks: Notebook[] = [];
    const batch = writeBatch(db);
  let needsUpdate = false;
  
  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    // Ensure slug exists (for backwards compatibility with existing notebooks)
    let slug = data.slug;
    if (!slug) {
      slug = createSlug(data.name || 'notebook');
      // Ensure uniqueness
      const existingSlugs = notebooks.map(nb => nb.slug || '');
      slug = ensureUniqueSlug(slug, existingSlugs);
      // Update in Firestore
      batch.update(docSnapshot.ref, { slug });
      needsUpdate = true;
    }
    
    notebooks.push({
      id: docSnapshot.id,
      ...data,
      slug,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    } as Notebook);
  }
  
  // Persist slugs if any were missing (non-blocking)
  // Don't block the app from loading if this fails
  if (needsUpdate) {
    batch.commit().catch((err) => {
      console.error('Failed to persist slugs to Firestore:', err);
      // Log but don't throw - notebooks are already in memory with slugs
    });
  }
  
    // Sort by createdAt client-side to avoid needing an index
    return notebooks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  });
};

export const updateNotebook = async (
  notebookId: string,
  updates: Partial<Notebook>
) => {
  const notebookRef = doc(db, 'notebooks', notebookId);
  
  // If name is being updated, regenerate slug
  if (updates.name) {
    const currentNotebook = await getDoc(notebookRef);
    if (currentNotebook.exists()) {
      const currentData = currentNotebook.data() as Notebook;
      const baseSlug = createSlug(updates.name);
      const existingNotebooks = await getNotebooks(currentData.userId);
      const existingSlugs = existingNotebooks
        .filter(nb => nb.id !== notebookId)
        .map(nb => nb.slug || '');
      const uniqueSlug = ensureUniqueSlug(baseSlug, existingSlugs);
      updates.slug = uniqueSlug;
    }
  }
  
  await updateDoc(notebookRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

// Get notebook by slug
export const getNotebookBySlug = async (userId: string, slug: string): Promise<Notebook | null> => {
  const q = query(
    collection(db, 'notebooks'),
    where('userId', '==', userId),
    where('slug', '==', slug)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate(),
    updatedAt: doc.data().updatedAt.toDate(),
  } as Notebook;
};

/**
 * Delete all notes for a specific notebook
 */
export const deleteAllNotesForNotebook = async (notebookId: string, userId?: string): Promise<number> => {
  const constraints = [
    where('notebookId', '==', notebookId)
  ];
  
  if (userId) {
    constraints.push(where('userId', '==', userId));
  }
  
  const q = query(collection(db, 'notes'), ...constraints);
  const snapshot = await getDocs(q);
  
  let deletedCount = 0;
  for (const noteDoc of snapshot.docs) {
    try {
      await deleteDoc(doc(db, 'notes', noteDoc.id));
      deletedCount++;
    } catch (error) {
      console.error(`Error deleting note ${noteDoc.id}:`, error);
    }
  }
  
  return deletedCount;
};

/**
 * Delete all tabs for a notebook (including staple tabs)
 */
export const deleteAllTabsForNotebookIncludingStaple = async (notebookId: string): Promise<number> => {
  const tabsRef = collection(db, 'tabs');
  const q = query(tabsRef, where('notebookId', '==', notebookId));
  const snapshot = await getDocs(q);
  
  let deletedCount = 0;
  for (const tabDoc of snapshot.docs) {
    try {
      await deleteDoc(doc(db, 'tabs', tabDoc.id));
      deletedCount++;
    } catch (error) {
      console.error(`Error deleting tab ${tabDoc.id}:`, error);
    }
  }
  
  return deletedCount;
};

export const deleteNotebook = async (notebookId: string, userId?: string) => {
  // First, delete all notes for this notebook
  const deletedNotesCount = await deleteAllNotesForNotebook(notebookId, userId);
  console.log(`Deleted ${deletedNotesCount} notes for notebook ${notebookId}`);
  
  // Then, delete all tabs for this notebook (including staple tabs)
  const deletedTabsCount = await deleteAllTabsForNotebookIncludingStaple(notebookId);
  console.log(`Deleted ${deletedTabsCount} tabs for notebook ${notebookId}`);
  
  // Finally, delete the notebook itself
  await deleteDoc(doc(db, 'notebooks', notebookId));
};

// Tabs
export const createTab = async (tab: Omit<Tab, 'id'>) => {
  const tabRef = doc(collection(db, 'tabs'));
  const tabData = {
    ...tab,
    id: tabRef.id,
    createdAt: Timestamp.now(),
  };
  await setDoc(tabRef, tabData);
  return tabRef.id;
};

export const getTabs = async (notebookId: string): Promise<Tab[]> => {
  const q = query(
    collection(db, 'tabs'),
    where('notebookId', '==', notebookId)
  );
  const snapshot = await getDocs(q);
  const tabs = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate(),
  })) as Tab[];
  
  // Sort by order client-side to avoid needing an index
  return tabs.sort((a, b) => a.order - b.order);
};

export const updateTab = async (tabId: string, updates: Partial<Tab>) => {
  const tabRef = doc(db, 'tabs', tabId);
  await updateDoc(tabRef, updates);
};

export const deleteTab = async (tabId: string) => {
  await deleteDoc(doc(db, 'tabs', tabId));
};

// Notes
export const createNote = async (note: Omit<Note, 'id'>) => {
  const noteRef = doc(collection(db, 'notes'));
  const noteData = {
    ...note,
    id: noteRef.id,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    deletedAt: null,
  };
  await setDoc(noteRef, noteData);
  return noteRef.id;
};

export const getNotes = async (
  notebookId: string,
  tabId?: string,
  userId?: string
): Promise<Note[]> => {
  // Build query with userId to ensure security rules can validate
  const constraints = [
    where('notebookId', '==', notebookId),
    where('deletedAt', '==', null)
  ];
  
  if (userId) {
    constraints.push(where('userId', '==', userId));
  }
  
  if (tabId && tabId !== 'staple') {
    constraints.push(where('tabId', '==', tabId));
  }
  
  const q = query(collection(db, 'notes'), ...constraints);
  const snapshot = await getDocs(q);
  const notes = snapshot.docs.map((doc) => {
    const data = doc.data();
    // Ensure images array exists - extract from content if missing
    let images = data.images || [];
    if (!Array.isArray(images) || images.length === 0) {
      // Extract images from HTML content if images array is missing or empty
      const content = data.content || '';
      if (content && typeof content === 'string') {
        // Simple regex to extract image URLs from HTML
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        const extractedUrls: string[] = [];
        let match;
        while ((match = imgRegex.exec(content)) !== null) {
          const url = match[1];
          // Only include non-data URLs (Firebase Storage URLs)
          if (url && !url.startsWith('data:') && !extractedUrls.includes(url)) {
            extractedUrls.push(url);
          }
        }
        if (extractedUrls.length > 0) {
          images = extractedUrls;
        }
      }
    }
    return {
      id: doc.id,
      ...data,
      images: images, // Ensure images array is always present
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      deletedAt: data.deletedAt?.toDate() || null,
    };
  }) as Note[];
  
  // Sort client-side to avoid index requirement
  return notes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
};

export const updateNote = async (noteId: string, updates: Partial<Note>) => {
  const noteRef = doc(db, 'notes', noteId);
  const updateData = {
    ...updates,
    updatedAt: Timestamp.now(),
  };
  
  // Get note title for better logging (if available in updates)
  const noteTitle = updates.title || 'unknown';
  
  console.log('[Firestore] Syncing note to cloud:', {
    noteId,
    title: noteTitle,
    updates: Object.keys(updates),
    timestamp: new Date().toISOString(),
  });
  
    try {
      // First, try to get the current note to verify it exists and log its current state
      const currentNote = await getDoc(noteRef);
      if (!currentNote.exists()) {
        console.error('[Firestore] ❌ Note does not exist in Firestore:', noteId);
        throw new Error(`Note ${noteId} does not exist in Firestore`);
      }
      
      const currentData = currentNote.data();
      const currentNotebookId = currentData.notebookId;
      const newNotebookId = updates.notebookId;
      
      // Check if notebookId is being updated and log a warning
      if (newNotebookId && newNotebookId !== currentNotebookId) {
        console.warn('[Firestore] ⚠️ Note notebookId mismatch detected:', {
          noteId,
          title: noteTitle,
          currentNotebookId,
          newNotebookId,
          action: 'Updating notebookId to match current notebook',
        });
      }
      
      console.log('[Firestore] Current note in Firestore:', {
        noteId,
        title: currentData.title || 'unknown',
        notebookId: currentNotebookId,
        lastUpdated: currentData.updatedAt?.toDate?.()?.toISOString() || 'unknown',
      });
      
      await updateDoc(noteRef, updateData);
      
      console.log('[Firestore] ✅ Successfully synced note to cloud:', {
        noteId,
        title: noteTitle,
        updatedAt: new Date().toISOString(),
        notebookId: newNotebookId || currentNotebookId,
      });
    } catch (error: any) {
      console.error('[Firestore] ❌ Error syncing note:', {
        noteId,
        title: noteTitle,
        error: error.message,
        code: error.code,
      });
      throw error;
    }
};

export const deleteNote = async (noteId: string) => {
  const noteRef = doc(db, 'notes', noteId);
  await updateDoc(noteRef, {
    deletedAt: Timestamp.now(),
  });
};

export const restoreNote = async (noteId: string) => {
  const noteRef = doc(db, 'notes', noteId);
  await updateDoc(noteRef, {
    deletedAt: null,
    updatedAt: Timestamp.now(),
  });
};

export const permanentlyDeleteNote = async (noteId: string) => {
  await deleteDoc(doc(db, 'notes', noteId));
};

/**
 * Delete ALL notes for a user (use with caution!)
 */
export const deleteAllNotesForUser = async (userId: string): Promise<number> => {
  const notesRef = collection(db, 'notes');
  const q = query(notesRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  let deletedCount = 0;
  for (const noteDoc of snapshot.docs) {
    try {
      await deleteDoc(doc(db, 'notes', noteDoc.id));
      deletedCount++;
    } catch (error) {
      console.error(`Error deleting note ${noteDoc.id}:`, error);
    }
  }
  
  return deletedCount;
};

/**
 * Delete ALL tabs for a notebook (use with caution!)
 * This will delete all tabs except staple tabs (Scratch, Now, etc.)
 */
export const deleteAllTabsForNotebook = async (notebookId: string, keepStapleTabs: boolean = true): Promise<number> => {
  const tabsRef = collection(db, 'tabs');
  const q = query(tabsRef, where('notebookId', '==', notebookId));
  const snapshot = await getDocs(q);
  
  let deletedCount = 0;
  for (const tabDoc of snapshot.docs) {
    const tabData = tabDoc.data();
    // Skip staple tabs if keepStapleTabs is true
    if (keepStapleTabs && tabData.isStaple) {
      continue;
    }
    
    try {
      await deleteDoc(doc(db, 'tabs', tabDoc.id));
      deletedCount++;
    } catch (error) {
      console.error(`Error deleting tab ${tabDoc.id}:`, error);
    }
  }
  
  return deletedCount;
};

/**
 * Delete ALL tabs for a user across all notebooks (use with caution!)
 */
export const deleteAllTabsForUser = async (userId: string, keepStapleTabs: boolean = true): Promise<number> => {
  // Get all notebooks for user
  const notebooks = await getNotebooks(userId);
  let totalDeleted = 0;
  
  for (const notebook of notebooks) {
    const deleted = await deleteAllTabsForNotebook(notebook.id, keepStapleTabs);
    totalDeleted += deleted;
  }
  
  return totalDeleted;
};

/**
 * Clean up orphaned tabs - tabs that belong to notebooks that don't exist
 * or tabs that don't have corresponding notes (for non-staple tabs)
 */
export const cleanupOrphanedTabs = async (userId: string): Promise<{ deleted: number; orphaned: Array<{ tabId: string; tabName: string; reason: string }> }> => {
  // Get all notebooks for user
  const notebooks = await getNotebooks(userId);
  const notebookIds = new Set(notebooks.map(nb => nb.id));
  
  // Get all tabs for user's notebooks
  const tabsRef = collection(db, 'tabs');
  const tabsSnapshot = await getDocs(tabsRef);
  
  const orphaned: Array<{ tabId: string; tabName: string; reason: string }> = [];
  let deletedCount = 0;
  
  for (const tabDoc of tabsSnapshot.docs) {
    const tabData = tabDoc.data();
    const tabId = tabDoc.id;
    const tabNotebookId = tabData.notebookId;
    
    // Skip if tab has no notebookId
    if (!tabNotebookId) {
      continue;
    }
    
    // Check if tab belongs to a notebook that doesn't exist (orphaned)
    if (!notebookIds.has(tabNotebookId)) {
      orphaned.push({
        tabId,
        tabName: tabData.name || 'Unknown',
        reason: `Notebook does not exist`
      });
      
      // Delete orphaned tab
      try {
        await deleteDoc(doc(db, 'tabs', tabId));
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting orphaned tab ${tabId}:`, error);
      }
      continue;
    }
    
    // For non-staple tabs in user's notebooks, check if they have a corresponding note
    if (!tabData.isStaple) {
      const notes = await getNotes(tabNotebookId, tabId, userId);
      // Filter out deleted notes
      const activeNotes = notes.filter(n => !n.deletedAt);
      if (activeNotes.length === 0) {
        // Tab has no active notes - it's orphaned
        orphaned.push({
          tabId,
          tabName: tabData.name || 'Unknown',
          reason: 'No corresponding notes found'
        });
        
        // Delete orphaned tab
        try {
          await deleteDoc(doc(db, 'tabs', tabId));
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting orphaned tab ${tabId}:`, error);
        }
      }
    }
  }
  
  return { deleted: deletedCount, orphaned };
};

export const getDeletedNotes = async (
  notebookId: string,
  userId?: string
): Promise<Note[]> => {
  // Firestore doesn't support != null queries directly
  // So we query all notes and filter client-side
  const constraints = [
    where('notebookId', '==', notebookId)
  ];
  
  if (userId) {
    constraints.push(where('userId', '==', userId));
  }
  
  const q = query(collection(db, 'notes'), ...constraints);
  const snapshot = await getDocs(q);
  const allNotes = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate(),
    updatedAt: doc.data().updatedAt.toDate(),
    deletedAt: doc.data().deletedAt?.toDate() || null,
  })) as Note[];
  
  // Filter for deleted notes (deletedAt is not null)
  const deletedNotes = allNotes.filter((n) => n.deletedAt !== null);
  
  // Sort client-side by deletion date (most recent first)
  return deletedNotes.sort((a, b) => {
    const aTime = a.deletedAt?.getTime() || 0;
    const bTime = b.deletedAt?.getTime() || 0;
    return bTime - aTime;
  });
};

// User Preferences
export const getUserPreferences = async (
  userId: string
): Promise<UserPreferences | null> => {
  const prefRef = doc(db, 'userPreferences', userId);
  const snapshot = await getDoc(prefRef);
  if (snapshot.exists()) {
    return snapshot.data() as UserPreferences;
  }
  return null;
};

export const updateUserPreferences = async (
  userId: string,
  updates: Partial<UserPreferences>
) => {
  const prefRef = doc(db, 'userPreferences', userId);
  await setDoc(prefRef, updates, { merge: true });
};

