'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getTabs, getNotes, createNote, createTab } from '@/lib/firebase/firestore';
import { Tab, Note } from '@/lib/types';
import BottomNav from '@/components/layout/BottomNav';
import NoteList from '@/components/notes/NoteList';
import { Timestamp } from 'firebase/firestore';

export default function NotebookPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const notebookId = params.notebookId as string;

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && notebookId) {
      loadTabs();
    }
  }, [user, notebookId]);

  useEffect(() => {
    if (activeTabId && notebookId && tabs.length > 0) {
      loadNotes();
    }
  }, [activeTabId, notebookId, tabs]);

  const loadTabs = async () => {
    if (!user) return;
    try {
      const tabsData = await getTabs(notebookId);
      setTabs(tabsData);
      if (tabsData.length > 0 && !activeTabId) {
        // Set first tab (Scratch) as active and open it immediately
        const scratchTab = tabsData.find((t) => t.name === 'Scratch') || tabsData[0];
        setActiveTabId(scratchTab.id);
        
        // If it's a staple note, ensure it exists and open it directly
        if (scratchTab.isStaple && scratchTab.name !== 'All Notes' && scratchTab.name !== 'More') {
          await ensureStapleNoteExists(scratchTab.name, scratchTab.id);
        }
      }
    } catch (error) {
      console.error('Error loading tabs:', error);
    } finally {
      setLoading(false);
    }
  };

  const ensureStapleNoteExists = async (stapleName: string, tabId: string) => {
    if (!user || !notebookId) return;
    
    try {
      const allNotes = await getNotes(notebookId, undefined, user.uid);
      let stapleNote = allNotes.find((n) => n.title === stapleName);
      
      // If note doesn't exist, create it
      if (!stapleNote) {
        const noteId = await createNote({
          userId: user.uid,
          notebookId,
          tabId: 'staple',
          title: stapleName,
          content: '',
          contentPlain: '',
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          deletedAt: null,
        });
        stapleNote = {
          id: noteId,
          userId: user.uid,
          notebookId,
          tabId: 'staple',
          title: stapleName,
          content: '',
          contentPlain: '',
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          deletedAt: null,
        } as Note;
      }
      
      // Open the note directly
      if (stapleNote) {
        router.push(`/dashboard/notebook/${notebookId}/note/${stapleNote.id}`);
      }
    } catch (error) {
      console.error('Error ensuring staple note exists:', error);
    }
  };

  const loadNotes = async () => {
    if (!user || !notebookId) return;
    try {
      // If clicking a staple tab (Scratch, Now, etc.), ensure note exists and open it
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab?.isStaple && activeTab.name !== 'All Notes' && activeTab.name !== 'More') {
        await ensureStapleNoteExists(activeTab.name, activeTab.id);
        return;
      }
      
      // For "All Notes" or regular tabs, show list
      const notesData = await getNotes(notebookId, activeTabId, user.uid);
      setNotes(notesData);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const handleCreateNote = async () => {
    if (!user || !notebookId) return;

    try {
      // Create new tab for the note
      const newTabId = await createTab({
        notebookId,
        name: 'New Note',
        icon: '📄',
        order: 0, // Will be to the left of Scratch
        isLocked: false,
        isStaple: false,
        createdAt: new Date(),
      });

      // Create new note
      const noteId = await createNote({
        userId: user.uid,
        notebookId,
        tabId: newTabId,
        title: '',
        content: '',
        contentPlain: '',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isArchived: false,
        deletedAt: null,
      });

      // Reload tabs and switch to new tab
      await loadTabs();
      setActiveTabId(newTabId);
      router.push(`/dashboard/notebook/${notebookId}/note/${noteId}`);
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const handleTabClick = async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.name === 'All Notes') {
      // Load all notes
      setActiveTabId(tabId);
      await loadAllNotes();
    } else if (tab?.name === 'More') {
      router.push(`/dashboard/notebook/${notebookId}/more`);
    } else if (tab?.isStaple && tab.name !== 'All Notes' && tab.name !== 'More') {
      // Staple tabs (Scratch, Now, etc.) are notes - ensure they exist and open them directly
      setActiveTabId(tabId);
      await ensureStapleNoteExists(tab.name, tabId);
    } else {
      // Regular note tabs - find the note and open it directly
      setActiveTabId(tabId);
      try {
        const notesData = await getNotes(notebookId, tabId, user?.uid);
        if (notesData.length > 0) {
          // Open the first note in this tab
          router.push(`/dashboard/notebook/${notebookId}/note/${notesData[0].id}`);
        }
      } catch (error) {
        console.error('Error loading note for tab:', error);
      }
    }
  };

  const loadAllNotes = async () => {
    if (!user || !notebookId) return;
    try {
      const notesData = await getNotes(notebookId, undefined, user.uid);
      setNotes(notesData);
    } catch (error) {
      console.error('Error loading all notes:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>Loading...</p>
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isAllNotesTab = activeTab?.name === 'All Notes';

  return (
    <div className="min-h-screen bg-black text-white pb-16">
      <div className="container mx-auto p-4">
        {activeTab && (
          <h1 className="text-2xl font-bold mb-4">{activeTab.name}</h1>
        )}
        {notes.length === 0 && !isAllNotesTab ? (
          <p className="text-gray-400">No notes yet. Create one with the + button.</p>
        ) : (
          <NoteList
            notes={notes}
            notebookId={notebookId}
            onNoteClick={(noteId) => {
              router.push(`/dashboard/notebook/${notebookId}/note/${noteId}`);
            }}
          />
        )}
      </div>
      <BottomNav
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={handleTabClick}
        onCreateNote={handleCreateNote}
      />
    </div>
  );
}

