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
  
  // Persist slugs if any were missing
  if (needsUpdate) {
    await batch.commit();
  }
  
  // Sort by createdAt client-side to avoid needing an index
  return notebooks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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

export const deleteNotebook = async (notebookId: string) => {
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
  const notes = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate(),
    updatedAt: doc.data().updatedAt.toDate(),
    deletedAt: doc.data().deletedAt?.toDate() || null,
  })) as Note[];
  
  // Sort client-side to avoid index requirement
  return notes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
};

export const updateNote = async (noteId: string, updates: Partial<Note>) => {
  const noteRef = doc(db, 'notes', noteId);
  await updateDoc(noteRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteNote = async (noteId: string) => {
  const noteRef = doc(db, 'notes', noteId);
  await updateDoc(noteRef, {
    deletedAt: Timestamp.now(),
  });
};

export const permanentlyDeleteNote = async (noteId: string) => {
  await deleteDoc(doc(db, 'notes', noteId));
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

