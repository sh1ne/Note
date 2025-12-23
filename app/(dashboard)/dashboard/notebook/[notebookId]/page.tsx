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
    try {
      const tabsData = await getTabs(notebookId);
      setTabs(tabsData);
      if (tabsData.length > 0 && !activeTabId) {
        // Set first tab (Scratch) as active and open it immediately
        const scratchTab = tabsData.find((t) => t.name === 'Scratch') || tabsData[0];
        setActiveTabId(scratchTab.id);
        
        // If it's a staple note, open it directly
        if (scratchTab.isStaple && scratchTab.name !== 'All Notes' && scratchTab.name !== 'More') {
          const allNotes = await getNotes(notebookId);
          const stapleNote = allNotes.find((n) => n.title === scratchTab.name);
          if (stapleNote) {
            router.push(`/dashboard/notebook/${notebookId}/note/${stapleNote.id}`);
            return;
          }
        }
      }
    } catch (error) {
      console.error('Error loading tabs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    if (!user || !notebookId) return;
    try {
      // If clicking a staple tab (Scratch, Now, etc.), find the note with that name
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab?.isStaple && activeTab.name !== 'All Notes' && activeTab.name !== 'More') {
        // Find the staple note by title
        const allNotes = await getNotes(notebookId);
        const stapleNote = allNotes.find((n) => n.title === activeTab.name);
        if (stapleNote) {
          // Open the note directly
          router.push(`/dashboard/notebook/${notebookId}/note/${stapleNote.id}`);
          return;
        }
      }
      
      // For "All Notes" or regular tabs, show list
      const notesData = await getNotes(notebookId, activeTabId);
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
    } else if (tab?.isStaple) {
      // Staple tabs (Scratch, Now, etc.) are notes - open them directly
      setActiveTabId(tabId);
      await loadNotes(); // This will redirect to the note
    } else {
      setActiveTabId(tabId);
    }
  };

  const loadAllNotes = async () => {
    if (!user || !notebookId) return;
    try {
      const notesData = await getNotes(notebookId);
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
  const isStapleNoteTab = activeTab?.isStaple && activeTab.name !== 'All Notes' && activeTab.name !== 'More';

  // Don't show list for staple notes (they open directly)
  if (isStapleNoteTab) {
    return (
      <div className="min-h-screen bg-black text-white pb-16">
        <div className="container mx-auto p-4">
          <p className="text-gray-400">Loading note...</p>
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

