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
  backups: {
    key: number; // keyPath is 'timestamp', which is a number
    value: { timestamp: number; data: any };
    indexes: { 'by-timestamp': number };
  };
}

let db: IDBPDatabase<NotesDB> | null = null;

export const getDB = async (): Promise<IDBPDatabase<NotesDB>> => {
  if (db) return db;
  
  db = await openDB<NotesDB>('notes-db', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('by-updatedAt', 'updatedAt');
        db.createObjectStore('syncQueue', { keyPath: 'noteId' });
      }
      if (oldVersion < 2) {
        const backupsStore = db.createObjectStore('backups', { keyPath: 'timestamp' });
        backupsStore.createIndex('by-timestamp', 'timestamp');
      }
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

// Backup functions
export const saveBackup = async (data: any) => {
  const database = await getDB();
  const timestamp = Date.now();
  await database.put('backups', { timestamp, data });
  
  // Keep only last 10 backups (delete older ones)
  const allBackups = await database.getAll('backups');
  if (allBackups.length > 10) {
    const sorted = allBackups.sort((a, b) => b.timestamp - a.timestamp);
    const toDelete = sorted.slice(10);
    for (const backup of toDelete) {
      // timestamp is the keyPath, so we need to pass it as the key
      await database.delete('backups', backup.timestamp);
    }
  }
};

export const getLatestBackup = async () => {
  const database = await getDB();
  const backups = await database.getAll('backups');
  if (backups.length === 0) return null;
  return backups.sort((a, b) => b.timestamp - a.timestamp)[0];
};

export const getAllBackups = async () => {
  const database = await getDB();
  return await database.getAll('backups');
};
