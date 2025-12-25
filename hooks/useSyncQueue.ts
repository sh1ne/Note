import { useEffect, useRef } from 'react';
import { getSyncQueue, removeFromSyncQueue } from '@/lib/utils/localStorage';
import { updateNote } from '@/lib/firebase/firestore';

/**
 * Hook to manage sync queue processing
 * Automatically processes queue when online and cleans up on unmount
 */
export function useSyncQueue() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  const processSyncQueue = async () => {
    // Prevent concurrent processing
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const queue = await getSyncQueue();
      
      for (const item of queue) {
        // Skip test items - they don't exist in Firestore
        if (item.noteId.startsWith('test-pending-')) {
          console.log('[Sync Queue] Skipping test item:', item.noteId);
          await removeFromSyncQueue(item.noteId);
          continue;
        }
        
        try {
          await updateNote(item.noteId, item.data);
          await removeFromSyncQueue(item.noteId);
          // Trigger sync event for UI update
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('note-synced'));
          }
        } catch (error) {
          console.error(`Error syncing note ${item.noteId}:`, error);
          // Dispatch error event for UI
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('note-sync-error', { 
              detail: { noteId: item.noteId, error } 
            }));
          }
          // Keep in queue for retry
        }
      }
    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      isProcessingRef.current = false;
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Process queue when coming online
    const handleOnline = () => {
      processSyncQueue();
    };

    window.addEventListener('online', handleOnline);

    // Process queue every 30 seconds
    intervalRef.current = setInterval(() => {
      processSyncQueue();
    }, 30000);

    // Process immediately on mount
    processSyncQueue();

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return { processSyncQueue };
}



