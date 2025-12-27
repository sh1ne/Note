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
          console.log('[Sync Queue] Attempting to sync note:', item.noteId, 'with data keys:', Object.keys(item.data));
          await updateNote(item.noteId, item.data);
          await removeFromSyncQueue(item.noteId);
          console.log('[Sync Queue] ✅ Successfully synced note:', item.noteId);
          // Trigger sync event for UI update with noteId
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('note-synced', { 
              detail: { noteId: item.noteId } 
            }));
          }
        } catch (error: any) {
          console.error(`[Sync Queue] ❌ Error syncing note ${item.noteId}:`, error);
          console.error('[Sync Queue] Error details:', {
            noteId: item.noteId,
            errorMessage: error?.message,
            errorCode: error?.code,
            dataKeys: Object.keys(item.data || {}),
          });
          
          // If note doesn't exist in Firestore, remove it from queue (it's stale)
          if (error?.message?.includes('does not exist in Firestore') || 
              (error?.message?.includes('Note') && error?.message?.includes('does not exist'))) {
            console.warn('[Sync Queue] ⚠️ Note does not exist, removing from queue:', item.noteId);
            await removeFromSyncQueue(item.noteId);
            // Trigger sync event to update UI (pending count will decrease)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('note-synced'));
            }
            continue; // Skip to next item
          }
          
          // Dispatch error event for UI
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('note-sync-error', { 
              detail: { noteId: item.noteId, error } 
            }));
          }
          // Keep in queue for retry (only for other errors)
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
