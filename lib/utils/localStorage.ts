import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Note, Notebook } from '../types';

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
  notebooks: {
    key: string;
    value: Notebook;
    indexes: { 'by-userId': string; 'by-slug': string };
  };
}

let db: IDBPDatabase<NotesDB> | null = null;

export const getDB = async (): Promise<IDBPDatabase<NotesDB>> => {
  if (db) return db;
  
  try {
    db = await openDB<NotesDB>('notes-db', 3, {
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
        if (oldVersion < 3) {
          const notebooksStore = db.createObjectStore('notebooks', { keyPath: 'id' });
          notebooksStore.createIndex('by-userId', 'userId');
          notebooksStore.createIndex('by-slug', 'slug');
        }
      },
    });
  } catch (error: any) {
    // If version error, the database might already be at a higher version
    // Try to open without specifying version to get the current version
    if (error?.name === 'VersionError' || error?.message?.includes('version')) {
      console.warn('Database version mismatch detected, attempting to reconnect...');
      // Reset the db reference and try to open without version (will use existing version)
      db = null;
      try {
        // Try to delete and recreate if version mismatch is critical
        // But first, try opening with a higher version
        db = await openDB<NotesDB>('notes-db', 4, {
          upgrade(db, oldVersion) {
            // Only create stores if they don't exist
            if (!db.objectStoreNames.contains('notes')) {
              const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
              notesStore.createIndex('by-updatedAt', 'updatedAt');
            }
            if (!db.objectStoreNames.contains('syncQueue')) {
              db.createObjectStore('syncQueue', { keyPath: 'noteId' });
            }
            if (!db.objectStoreNames.contains('backups')) {
              const backupsStore = db.createObjectStore('backups', { keyPath: 'timestamp' });
              backupsStore.createIndex('by-timestamp', 'timestamp');
            }
            if (!db.objectStoreNames.contains('notebooks')) {
              const notebooksStore = db.createObjectStore('notebooks', { keyPath: 'id' });
              notebooksStore.createIndex('by-userId', 'userId');
              notebooksStore.createIndex('by-slug', 'slug');
            }
          },
        });
      } catch (retryError) {
        console.error('Failed to reconnect to database:', retryError);
        throw retryError;
      }
    } else {
      throw error;
    }
  }
  
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

// Notebook storage functions
export const saveNotebookLocally = async (notebook: Notebook) => {
  const database = await getDB();
  await database.put('notebooks', {
    ...notebook,
    updatedAt: new Date(),
  });
};

export const getNotebookLocally = async (notebookId: string): Promise<Notebook | undefined> => {
  const database = await getDB();
  return await database.get('notebooks', notebookId);
};

export const getAllNotebooksLocally = async (): Promise<Notebook[]> => {
  const database = await getDB();
  return await database.getAll('notebooks');
};

export const getNotebookBySlugLocally = async (userId: string, slug: string): Promise<Notebook | null> => {
  const database = await getDB();
  const tx = database.transaction('notebooks', 'readonly');
  const index = tx.store.index('by-slug');
  const notebooks = await index.getAll(slug);
  await tx.done;
  
  // Filter by userId and slug (index only filters by slug)
  const matchingNotebook = notebooks.find((nb) => nb.userId === userId && nb.slug === slug);
  return matchingNotebook || null;
};
