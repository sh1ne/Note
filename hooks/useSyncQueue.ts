import { useEffect, useRef } from 'react';
import { getSyncQueue, removeFromSyncQueue, getNoteLocally, saveNoteLocally, getAllNotesLocally } from '@/lib/utils/localStorage';
import { updateNote, createNote, createTab } from '@/lib/firebase/firestore';

/**
 * Hook to manage sync queue processing
 * Automatically processes queue when online and cleans up on unmount
 */
export function useSyncQueue() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  const processSyncQueue = async () => {
    const timestamp = new Date().toISOString();
    const isOnline = typeof window !== 'undefined' ? navigator.onLine : false;
    
    console.log(`[SYNC_TRACE][useSyncQueue][PROCESS_CALLED][online=${isOnline}][isProcessing=${isProcessingRef.current}][timestamp=${timestamp}] processSyncQueue called`);
    
    // Prevent concurrent processing
    if (isProcessingRef.current) {
      console.log(`[SYNC_TRACE][useSyncQueue][PROCESS_SKIPPED][online=${isOnline}][reason=already_processing][timestamp=${timestamp}] Already processing, skipping`);
      return;
    }
    
    // Only process if online
    if (typeof window !== 'undefined' && !navigator.onLine) {
      console.log(`[SYNC_TRACE][useSyncQueue][PROCESS_BLOCKED][online=${isOnline}][reason=offline][timestamp=${timestamp}] ⚠️ BLOCKED - Attempted to process sync queue while OFFLINE`);
      return;
    }
    
    console.log(`[SYNC_TRACE][useSyncQueue][PROCESS_START][online=${isOnline}][timestamp=${timestamp}] Starting sync queue processing`);
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
          // Check if this is a temporary ID (note created offline)
          const isTempId = item.noteId.startsWith('temp-');
          
          if (isTempId) {
            // This is a new note created offline - need to CREATE it in Firestore
            console.log('[Sync Queue] Creating new note in Firestore (was created offline):', item.noteId);
            
            // Get the full note from IndexedDB
            const localNote = await getNoteLocally(item.noteId);
            if (!localNote) {
              console.warn('[Sync Queue] ⚠️ Note not found in IndexedDB, removing from queue:', item.noteId);
              await removeFromSyncQueue(item.noteId);
              continue;
            }
            
            // Create tab first (if tabId is also temp)
            let newTabId = localNote.tabId;
            if (localNote.tabId && localNote.tabId.startsWith('temp-tab-')) {
              // Create tab in Firestore
              // We need to get tab name from the note title or use a default
              const tabName = localNote.title || 'Untitled Note';
              newTabId = await createTab({
                notebookId: localNote.notebookId,
                name: tabName,
                icon: '📄',
                order: 0,
                isLocked: false,
                isStaple: false,
                createdAt: new Date(),
              });
              console.log('[Sync Queue] Created tab in Firestore:', newTabId);
            }
            
            // Create note in Firestore
            const newNoteId = await createNote({
              userId: localNote.userId,
              notebookId: localNote.notebookId,
              tabId: newTabId,
              title: localNote.title,
              content: localNote.content,
              contentPlain: localNote.contentPlain,
              images: localNote.images || [],
              createdAt: localNote.createdAt,
              updatedAt: localNote.updatedAt,
              isArchived: localNote.isArchived || false,
              deletedAt: localNote.deletedAt || null,
            });
            console.log('[Sync Queue] Created note in Firestore:', newNoteId);
            
            // Update local note with new IDs
            const updatedNote = {
              ...localNote,
              id: newNoteId,
              tabId: newTabId,
            };
            await saveNoteLocally(updatedNote);
            
            // Update any other sync queue items that reference the old temp ID
            // (This handles the case where multiple edits were queued for the same temp note)
            const { addToSyncQueue } = await import('@/lib/utils/localStorage');
            const allQueueItems = await getSyncQueue();
            for (const queueItem of allQueueItems) {
              if (queueItem.noteId === item.noteId && queueItem !== item) {
                // Update this queue item to use the new ID
                await removeFromSyncQueue(queueItem.noteId);
                await addToSyncQueue(newNoteId, queueItem.data);
              }
            }
            
            // Remove old temp ID from queue
            await removeFromSyncQueue(item.noteId);
            console.log('[Sync Queue] ✅ Successfully created and synced note:', newNoteId);
            
            // Trigger sync event for UI update
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('note-synced', { 
                detail: { noteId: newNoteId } 
              }));
            }
          } else {
            // Existing note - just update it
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

    const mountTimestamp = new Date().toISOString();
    const isOnline = navigator.onLine;
    const hookId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[SYNC_TRACE][useSyncQueue][MOUNT][id=${hookId}][online=${isOnline}][timestamp=${mountTimestamp}] useSyncQueue hook mounted`);

    // HARD GUARANTEE: Only set up sync processing if we're online
    // This prevents any sync attempts while offline
    if (!navigator.onLine) {
      console.log(`[SYNC_TRACE][useSyncQueue][SETUP_OFFLINE][id=${hookId}][online=${isOnline}][timestamp=${mountTimestamp}] Offline on mount - not setting up sync processing (no interval, no immediate call)`);
      // Only set up online event listener - no interval, no immediate processing
      const handleOnline = () => {
        const onlineTimestamp = new Date().toISOString();
        const wasOnline = navigator.onLine;
        console.log(`[SYNC_TRACE][useSyncQueue][ONLINE_EVENT][id=${hookId}][online=${wasOnline}][timestamp=${onlineTimestamp}] Online event fired - setting up sync processing`);
        
        // When coming online, set up the interval and process queue
        console.log('[Sync Queue] Coming online - setting up sync processing');
        processSyncQueue();
        
        // Set up interval only when online
        if (intervalRef.current) {
          console.log(`[SYNC_TRACE][useSyncQueue][INTERVAL_CLEARED][id=${hookId}][timestamp=${onlineTimestamp}] Clearing existing interval before creating new one`);
          clearInterval(intervalRef.current);
        }
        intervalRef.current = setInterval(() => {
          const intervalTimestamp = new Date().toISOString();
          const stillOnline = navigator.onLine;
          console.log(`[SYNC_TRACE][useSyncQueue][INTERVAL_TICK][id=${hookId}][online=${stillOnline}][timestamp=${intervalTimestamp}] Interval tick`);
          // Double-check we're still online before processing
          if (navigator.onLine) {
            processSyncQueue();
          } else {
            console.log(`[SYNC_TRACE][useSyncQueue][INTERVAL_SKIPPED][id=${hookId}][online=${stillOnline}][timestamp=${intervalTimestamp}] Interval tick skipped - went offline`);
          }
        }, 30000);
        console.log(`[SYNC_TRACE][useSyncQueue][INTERVAL_CREATED][id=${hookId}][online=${wasOnline}][timestamp=${onlineTimestamp}] Interval created (30s)`);
      };

      window.addEventListener('online', handleOnline);

      return () => {
        const unmountTimestamp = new Date().toISOString();
        console.log(`[SYNC_TRACE][useSyncQueue][UNMOUNT][id=${hookId}][online=${navigator.onLine}][timestamp=${unmountTimestamp}] useSyncQueue hook unmounting (offline setup)`);
        window.removeEventListener('online', handleOnline);
        if (intervalRef.current) {
          console.log(`[SYNC_TRACE][useSyncQueue][INTERVAL_CLEARED][id=${hookId}][timestamp=${unmountTimestamp}] Clearing interval on unmount`);
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }

    // We're online - set up full sync processing
    console.log(`[SYNC_TRACE][useSyncQueue][SETUP_ONLINE][id=${hookId}][online=${isOnline}][timestamp=${mountTimestamp}] Online on mount - setting up full sync processing`);
    
    const handleOnline = () => {
      const onlineTimestamp = new Date().toISOString();
      console.log(`[SYNC_TRACE][useSyncQueue][ONLINE_EVENT][id=${hookId}][online=${navigator.onLine}][timestamp=${onlineTimestamp}] Online event fired`);
      processSyncQueue();
    };

    window.addEventListener('online', handleOnline);

    // Process queue every 30 seconds (only if online)
    intervalRef.current = setInterval(() => {
      const intervalTimestamp = new Date().toISOString();
      const stillOnline = navigator.onLine;
      console.log(`[SYNC_TRACE][useSyncQueue][INTERVAL_TICK][id=${hookId}][online=${stillOnline}][timestamp=${intervalTimestamp}] Interval tick`);
      // Double-check we're still online before processing
      if (navigator.onLine) {
        processSyncQueue();
      } else {
        console.log(`[SYNC_TRACE][useSyncQueue][INTERVAL_SKIPPED][id=${hookId}][online=${stillOnline}][timestamp=${intervalTimestamp}] Interval tick skipped - went offline`);
      }
    }, 30000);
    console.log(`[SYNC_TRACE][useSyncQueue][INTERVAL_CREATED][id=${hookId}][online=${isOnline}][timestamp=${mountTimestamp}] Interval created (30s)`);

    // Process immediately on mount (we're online)
    console.log(`[SYNC_TRACE][useSyncQueue][IMMEDIATE_PROCESS][id=${hookId}][online=${isOnline}][timestamp=${mountTimestamp}] Processing queue immediately on mount`);
    processSyncQueue();

    // Cleanup
    return () => {
      const unmountTimestamp = new Date().toISOString();
      console.log(`[SYNC_TRACE][useSyncQueue][UNMOUNT][id=${hookId}][online=${navigator.onLine}][timestamp=${unmountTimestamp}] useSyncQueue hook unmounting (online setup)`);
      window.removeEventListener('online', handleOnline);
      if (intervalRef.current) {
        console.log(`[SYNC_TRACE][useSyncQueue][INTERVAL_CLEARED][id=${hookId}][timestamp=${unmountTimestamp}] Clearing interval on unmount`);
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return { processSyncQueue };
}
