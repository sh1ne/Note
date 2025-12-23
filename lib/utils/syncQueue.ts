import { getSyncQueue, removeFromSyncQueue } from './localStorage';
import { updateNote } from '../firebase/firestore';

export const processSyncQueue = async () => {
  const queue = await getSyncQueue();
  
  for (const item of queue) {
    try {
      await updateNote(item.noteId, item.data);
      await removeFromSyncQueue(item.noteId);
    } catch (error) {
      console.error(`Error syncing note ${item.noteId}:`, error);
      // Keep in queue for retry
    }
  }
};

// Process queue when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processSyncQueue();
  });
  
  // Process queue every 30 seconds
  setInterval(() => {
    processSyncQueue();
  }, 30000);
}

