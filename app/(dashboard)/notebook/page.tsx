'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getNotebooks, createNotebook, createTab, createNote } from '@/lib/firebase/firestore';
import { getUserPreferences, updateUserPreferences } from '@/lib/firebase/firestore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';

const STAPLE_NOTES = [
  { name: 'Scratch', icon: '✏️', order: 1 },
  { name: 'Now', icon: '⏰', order: 2 },
  { name: 'Short-Term', icon: '📅', order: 3 },
  { name: 'Long-term', icon: '📆', order: 4 },
];

export default function NotebookPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        initializeUser();
      } else {
        router.push('/login');
      }
    }
  }, [user, authLoading, router]);

  const initializeUser = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      // Get user preferences to find current notebook
      const prefs = await getUserPreferences(user.uid);
      
      if (prefs?.currentNotebookId) {
        // Get notebook to get its slug
        const notebooks = await getNotebooks(user.uid);
        const currentNotebook = notebooks.find(nb => nb.id === prefs.currentNotebookId);
        if (currentNotebook) {
          router.push(`/${currentNotebook.slug}`);
          return;
        }
      }

      // Check if user has any notebooks
      const notebooks = await getNotebooks(user.uid);
      
      if (notebooks.length > 0) {
        // Use first notebook
        const notebook = notebooks[0];
        await updateUserPreferences(user.uid, { currentNotebookId: notebook.id });
        router.push(`/${notebook.slug}`);
        return;
      }

      // No notebooks exist, create default one with staple notes
      await createDefaultNotebook();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize';
      console.error('Error initializing user:', err);
      setError(errorMessage);
    }
  }, [user, router]);

  const createDefaultNotebook = async () => {
    if (!user) return;

    try {
      setError(null);
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

      // Get notebook to get its slug for redirect
      const notebooks = await getNotebooks(user.uid);
      const newNotebook = notebooks.find(nb => nb.id === notebookId);
      if (newNotebook) {
        router.push(`/${newNotebook.slug}`);
      } else {
        // Fallback to ID if slug not found (shouldn't happen)
        router.push(`/notebook/${notebookId}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create notebook';
      console.error('Error creating default notebook:', err);
      setError(errorMessage);
    }
  };

  if (authLoading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (error) {
    return (
      <ErrorMessage
        message={error}
        onRetry={initializeUser}
      />
    );
  }

  return <LoadingSpinner message="Setting up your notebook..." />;
}

