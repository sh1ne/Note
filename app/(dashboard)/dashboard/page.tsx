'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getNotebooks, createNotebook, createTab, createNote } from '@/lib/firebase/firestore';
import { getUserPreferences, updateUserPreferences } from '@/lib/firebase/firestore';

const STAPLE_NOTES = [
  { name: 'Scratch', icon: '✏️', order: 1 },
  { name: 'Now', icon: '⏰', order: 2 },
  { name: 'Short-Term', icon: '📅', order: 3 },
  { name: 'Long-term', icon: '📆', order: 4 },
];

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        initializeUser();
      } else {
        router.push('/login');
      }
    }
  }, [user, authLoading, router]);

  const initializeUser = async () => {
    if (!user) return;

    try {
      // Get user preferences to find current notebook
      const prefs = await getUserPreferences(user.uid);
      
      if (prefs?.currentNotebookId) {
        // User has a notebook, go directly to it
        router.push(`/dashboard/notebook/${prefs.currentNotebookId}`);
        return;
      }

      // Check if user has any notebooks
      const notebooks = await getNotebooks(user.uid);
      
      if (notebooks.length > 0) {
        // Use first notebook
        const notebookId = notebooks[0].id;
        await updateUserPreferences(user.uid, { currentNotebookId: notebookId });
        router.push(`/dashboard/notebook/${notebookId}`);
        return;
      }

      // No notebooks exist, create default one with staple notes
      await createDefaultNotebook();
    } catch (error) {
      console.error('Error initializing user:', error);
    }
  };

  const createDefaultNotebook = async () => {
    if (!user) return;

    try {
      // Create default notebook
      const notebookId = await createNotebook({
        userId: user.uid,
        name: 'My Notebook',
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: true,
      });

      // Create the 4 staple notes (Scratch, Now, Short-Term, Long-term)
      for (const staple of STAPLE_NOTES) {
        const noteId = await createNote({
          userId: user.uid,
          notebookId,
          tabId: 'staple', // Special tabId for staple notes
          title: staple.name,
          content: '',
          contentPlain: '',
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          deletedAt: null,
        });

        // Create a "tab" entry for navigation (but it's really a note)
        await createTab({
          notebookId,
          name: staple.name,
          icon: staple.icon,
          order: staple.order,
          isLocked: true,
          isStaple: true,
          createdAt: new Date(),
        });
      }

      // Create "All Notes" and "More" tabs
      await createTab({
        notebookId,
        name: 'All Notes',
        icon: '📋',
        order: 5,
        isLocked: true,
        isStaple: true,
        createdAt: new Date(),
      });

      await createTab({
        notebookId,
        name: 'More',
        icon: '⋯',
        order: 6,
        isLocked: true,
        isStaple: true,
        createdAt: new Date(),
      });

      // Save current notebook preference
      await updateUserPreferences(user.uid, { currentNotebookId: notebookId });

      // Redirect to notebook
      router.push(`/dashboard/notebook/${notebookId}`);
    } catch (error) {
      console.error('Error creating default notebook:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <p>Loading...</p>
    </div>
  );
}

