import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Note, Notebook } from '../types';

export interface AuthState {
  id: 'current'; // Always "current" - single auth state record
  userId: string;
  email: string;
  lastVerified: Date;
  token?: string; // Optional Firebase ID token
}

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
  auth: {
    key: 'current';
    value: AuthState;
  };
}

let db: IDBPDatabase<NotesDB> | null = null;

export const getDB = async (): Promise<IDBPDatabase<NotesDB>> => {
  if (db) return db;
  
  // Always try to open with the highest version we support (5)
  // This prevents issues where cached old code tries to use lower versions
  const TARGET_VERSION = 5;
  
  try {
    db = await openDB<NotesDB>('notes-db', TARGET_VERSION, {
      upgrade(db, oldVersion) {
        console.log(`[IndexedDB] Upgrading from version ${oldVersion} to ${TARGET_VERSION}`);
        
        // Create stores if they don't exist (handles both new DBs and upgrades)
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
        
        // Create auth store if it doesn't exist (version 5+)
        if (!db.objectStoreNames.contains('auth')) {
          db.createObjectStore('auth', { keyPath: 'id' });
        }
      },
    });
    console.log(`[IndexedDB] Successfully opened database at version ${TARGET_VERSION}`);
  } catch (error: any) {
    // Handle version errors - database might be at a different version
    if (error?.name === 'VersionError' || error?.message?.includes('version')) {
      console.warn('[IndexedDB] VersionError detected:', error.message);
      console.warn('[IndexedDB] Attempting to resolve version conflict...');
      
      // Reset the db reference
      db = null;
      
      // Try to open with an even higher version to force upgrade
      // This handles cases where the database is at a version higher than we expect
      try {
        const HIGHER_VERSION = TARGET_VERSION + 1;
        db = await openDB<NotesDB>('notes-db', HIGHER_VERSION, {
          upgrade(db, oldVersion) {
            console.log(`[IndexedDB] Upgrading from version ${oldVersion} to ${HIGHER_VERSION}`);
            
            // Ensure all stores exist
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
            
            // Create auth store if it doesn't exist (version 5+)
            if (!db.objectStoreNames.contains('auth')) {
              db.createObjectStore('auth', { keyPath: 'id' });
            }
          },
        });
        console.log(`[IndexedDB] Successfully opened database at version ${HIGHER_VERSION}`);
      } catch (retryError: any) {
        console.error('[IndexedDB] Failed to resolve version conflict:', retryError);
        // If we still can't open, log the error but don't throw
        // This allows the app to continue functioning (though IndexedDB features won't work)
        console.error('[IndexedDB] IndexedDB operations will be unavailable. Error:', retryError.message);
        throw new Error(`Failed to open IndexedDB: ${retryError.message}`);
      }
    } else {
      // For non-version errors, throw immediately
      console.error('[IndexedDB] Error opening database:', error);
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
  try {
    const database = await getDB();
    return await database.getAll('notes');
  } catch (error: any) {
    // If IndexedDB is unavailable (e.g., VersionError), return empty array
    // This allows navigation to continue working even if IndexedDB fails
    console.warn('[IndexedDB] Failed to get all notes locally, returning empty array:', error?.message);
    return [];
  }
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
  try {
    const database = await getDB();
    return await database.getAll('syncQueue');
  } catch (error: any) {
    // If IndexedDB is unavailable (e.g., VersionError), return empty array
    // This allows sync queue processing to continue without breaking
    console.warn('[IndexedDB] Failed to get sync queue, returning empty array:', error?.message);
    return [];
  }
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
  try {
    const database = await getDB();
    return await database.getAll('notebooks');
  } catch (error: any) {
    // If IndexedDB is unavailable (e.g., VersionError), return empty array
    // This allows navigation to continue working even if IndexedDB fails
    console.warn('[IndexedDB] Failed to get all notebooks locally, returning empty array:', error?.message);
    return [];
  }
};

export const getNotebookBySlugLocally = async (userId: string, slug: string): Promise<Notebook | null> => {
  try {
    const database = await getDB();
    const tx = database.transaction('notebooks', 'readonly');
    const index = tx.store.index('by-slug');
    const notebooks = await index.getAll(slug);
    await tx.done;
    
    // Filter by userId and slug (index only filters by slug)
    const matchingNotebook = notebooks.find((nb) => nb.userId === userId && nb.slug === slug);
    return matchingNotebook || null;
  } catch (error: any) {
    // If IndexedDB is unavailable (e.g., VersionError), return null
    // This allows navigation to continue working even if IndexedDB fails
    console.warn('[IndexedDB] Failed to get notebook by slug locally, returning null:', error?.message);
    return null;
  }
};
