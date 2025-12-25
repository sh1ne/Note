/**
 * Script to delete ALL notes from Firestore
 * WARNING: This will permanently delete all notes. Use with caution!
 * 
 * To run this:
 * 1. Open browser console on your app
 * 2. Copy and paste this entire script
 * 3. Or import and call deleteAllNotes() from a page
 */

import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export async function deleteAllNotes(userId?: string) {
  if (typeof window === 'undefined') {
    console.error('This script must run in the browser');
    return;
  }

  if (!userId) {
    console.error('userId is required');
    return;
  }

  try {
    console.log('🗑️ Starting deletion of all notes...');
    
    // Get all notes (optionally filter by userId)
    const notesRef = collection(db, 'notes');
    const q = userId 
      ? query(notesRef, where('userId', '==', userId))
      : notesRef;
    
    const snapshot = await getDocs(q);
    const notes = snapshot.docs;
    
    console.log(`Found ${notes.length} notes to delete`);
    
    if (notes.length === 0) {
      console.log('No notes to delete');
      return;
    }

    // Confirm deletion
    const confirmed = window.confirm(
      `⚠️ WARNING: This will permanently delete ${notes.length} note(s).\n\nThis cannot be undone!\n\nClick OK to proceed.`
    );

    if (!confirmed) {
      console.log('Deletion cancelled');
      return;
    }

    // Delete all notes
    let deletedCount = 0;
    for (const noteDoc of notes) {
      try {
        await deleteDoc(doc(db, 'notes', noteDoc.id));
        deletedCount++;
        console.log(`Deleted note: ${noteDoc.id} (${noteDoc.data().title || 'untitled'})`);
      } catch (error) {
        console.error(`Error deleting note ${noteDoc.id}:`, error);
      }
    }

    console.log(`✅ Successfully deleted ${deletedCount} of ${notes.length} notes`);
    
    // Also clear local storage
    console.log('🧹 Clearing local storage...');
    const { getDB } = await import('@/lib/utils/localStorage');
    const database = await getDB();
    const localNotes = await database.getAll('notes');
    for (const note of localNotes) {
      await database.delete('notes', note.id);
    }
    console.log(`✅ Cleared ${localNotes.length} notes from local storage`);
    
    // Clear sync queue
    const syncQueue = await database.getAll('syncQueue');
    for (const item of syncQueue) {
      await database.delete('syncQueue', item.noteId);
    }
    console.log(`✅ Cleared ${syncQueue.length} items from sync queue`);
    
    console.log('🎉 Cleanup complete! Refresh the page.');
    
  } catch (error) {
    console.error('❌ Error deleting notes:', error);
  }
}

// Browser console version (paste this directly in console)
export const deleteAllNotesConsole = `
(async function() {
  const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
  const { collection, getDocs, deleteDoc, doc, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  
  // Get current user
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    console.error('No user logged in');
    return;
  }
  
  console.log('🗑️ Starting deletion of all notes for user:', user.uid);
  
  // Import db from your app (you'll need to adjust this)
  // For now, let's use a simpler approach - create a page button
})();
`;

