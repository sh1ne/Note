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

// Notebooks
export const createNotebook = async (notebook: Omit<Notebook, 'id'>) => {
  if (typeof window === 'undefined') {
    throw new Error('Firestore can only be used in browser');
  }
  const notebookRef = doc(collection(db, 'notebooks'));
  const notebookData = {
    ...notebook,
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
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate(),
    updatedAt: doc.data().updatedAt.toDate(),
  })) as Notebook[];
};

export const updateNotebook = async (
  notebookId: string,
  updates: Partial<Notebook>
) => {
  const notebookRef = doc(db, 'notebooks', notebookId);
  await updateDoc(notebookRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
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
  tabId?: string
): Promise<Note[]> => {
  let q = query(
    collection(db, 'notes'),
    where('notebookId', '==', notebookId),
    where('deletedAt', '==', null),
    orderBy('updatedAt', 'desc')
  );
  
  if (tabId) {
    q = query(
      collection(db, 'notes'),
      where('notebookId', '==', notebookId),
      where('tabId', '==', tabId),
      where('deletedAt', '==', null),
      orderBy('updatedAt', 'desc')
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate(),
    updatedAt: doc.data().updatedAt.toDate(),
    deletedAt: doc.data().deletedAt?.toDate() || null,
  })) as Note[];
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

