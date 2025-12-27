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
    // Prevent concurrent processing
    if (isProcessingRef.current) return;
    
    // Only process if online
    if (typeof window !== 'undefined' && !navigator.onLine) {
      return;
    }
    
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
