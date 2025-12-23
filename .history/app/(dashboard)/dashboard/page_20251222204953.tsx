'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getNotebooks, createNotebook, getTabs, createTab } from '@/lib/firebase/firestore';
import { Notebook } from '@/lib/types';
import { logOut } from '@/lib/firebase/auth';
import Link from 'next/link';

const DEFAULT_TABS = [
  { name: 'Scratch', icon: '✏️', order: 1, isStaple: true },
  { name: 'Now', icon: '⏰', order: 2, isStaple: true },
  { name: 'Short-Term', icon: '📅', order: 3, isStaple: true },
  { name: 'Long-term', icon: '📆', order: 4, isStaple: true },
  { name: 'All Notes', icon: '📋', order: 5, isStaple: true },
  { name: 'More', icon: '⋯', order: 6, isStaple: true },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotebooks();
    }
  }, [user]);

  const loadNotebooks = async () => {
    if (!user) return;
    try {
      const data = await getNotebooks(user.uid);
      setNotebooks(data);
      
      // If no notebooks, create default one
      if (data.length === 0 && !creating) {
        await createDefaultNotebook();
      }
    } catch (error) {
      console.error('Error loading notebooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultNotebook = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      // Create default notebook
      const notebookId = await createNotebook({
        userId: user.uid,
        name: 'My Notebook',
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: true,
      });

      // Create default tabs
      for (const tab of DEFAULT_TABS) {
        await createTab({
          notebookId,
          name: tab.name,
          icon: tab.icon,
          order: tab.order,
          isLocked: true,
          isStaple: tab.isStaple,
          createdAt: new Date(),
        });
      }

      // Reload notebooks
      await loadNotebooks();
      
      // Redirect to the notebook
      router.push(`/dashboard/notebook/${notebookId}`);
    } catch (error) {
      console.error('Error creating default notebook:', error);
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading || creating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>{creating ? 'Creating your notebook...' : 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Notebooks</h1>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-gray-400">{user.email}</span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
        {notebooks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No notebooks yet.</p>
            <button
              onClick={createDefaultNotebook}
              disabled={creating}
              className="px-6 py-2 bg-white text-black rounded font-semibold hover:bg-gray-200 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Default Notebook'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {notebooks.map((notebook) => (
              <Link
                key={notebook.id}
                href={`/dashboard/notebook/${notebook.id}`}
                className="block p-4 bg-gray-900 rounded hover:bg-gray-800"
              >
                <h2 className="font-semibold">{notebook.name}</h2>
                <p className="text-sm text-gray-400">
                  {notebook.isDefault ? 'Default' : 'Custom'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

