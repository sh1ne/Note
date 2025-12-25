import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Note } from '../types';

interface NotesDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-updatedAt': Date };
  };
  syncQueue: {
    key: string;
    value: { noteId: string; data: Partial<Note>; timestamp: number };
  };
}

let db: IDBPDatabase<NotesDB> | null = null;

export const getDB = async (): Promise<IDBPDatabase<NotesDB>> => {
  if (db) return db;
  
  db = await openDB<NotesDB>('notes-db', 1, {
    upgrade(db) {
      const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
      notesStore.createIndex('by-updatedAt', 'updatedAt');
      
      db.createObjectStore('syncQueue', { keyPath: 'noteId' });
    },
  });
  
  return db;
};

export const saveNoteLocally = async (note: Note) => {
  const database = await getDB();
  await database.put('notes', {
    ...note,
    updatedAt: new Date(),
  });
};

export const getNoteLocally = async (noteId: string): Promise<Note | undefined> => {
  const database = await getDB();
  return await database.get('notes', noteId);
};

export const getAllNotesLocally = async (): Promise<Note[]> => {
  const database = await getDB();
  return await database.getAll('notes');
};

export const deleteNoteLocally = async (noteId: string) => {
  const database = await getDB();
  await database.delete('notes', noteId);
};

export const addToSyncQueue = async (noteId: string, data: Partial<Note>) => {
  const database = await getDB();
  await database.put('syncQueue', {
    noteId,
    data,
    timestamp: Date.now(),
  });
};

export const getSyncQueue = async () => {
  const database = await getDB();
  return await database.getAll('syncQueue');
};

export const removeFromSyncQueue = async (noteId: string) => {
  const database = await getDB();
  await database.delete('syncQueue', noteId);
};



