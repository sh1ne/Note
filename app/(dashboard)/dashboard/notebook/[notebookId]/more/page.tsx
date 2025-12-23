'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { logOut } from '@/lib/firebase/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { getNotebooks, getNotes } from '@/lib/firebase/firestore';
import { Notebook, Note } from '@/lib/types';
import { useEffect, useState } from 'react';
import Link from 'next/link';

function StorageUsageDisplay({ userId }: { userId: string }) {
  const [usage, setUsage] = useState<{ notes: number; estimatedSize: string } | null>(null);
  const params = useParams();
  const notebookId = params.notebookId as string;

  useEffect(() => {
    if (userId && notebookId) {
      calculateStorage();
    }
  }, [userId, notebookId]);

  const calculateStorage = async () => {
    try {
      const notes = await getNotes(notebookId, undefined, userId);
      // Rough estimate: each note ~1-5KB, images are stored separately
      const estimatedBytes = notes.length * 3000; // 3KB average per note
      const estimatedMB = (estimatedBytes / (1024 * 1024)).toFixed(2);
      setUsage({
        notes: notes.length,
        estimatedSize: estimatedMB,
      });
    } catch (error) {
      console.error('Error calculating storage:', error);
    }
  };

  if (!usage) {
    return (
      <>
        <p className="text-gray-400 text-sm">Calculating...</p>
        <p className="text-xs text-gray-500 mt-2">Estimating storage usage</p>
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-300">Notes:</span>
          <span className="text-sm text-white font-semibold">{usage.notes}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-300">Estimated Size:</span>
          <span className="text-sm text-white font-semibold">{usage.estimatedSize} MB</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">Note: This is an estimate. Images are stored separately.</p>
    </>
  );
}

export default function MorePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const notebookId = params.notebookId as string;
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);

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
    } catch (error) {
      console.error('Error loading notebooks:', error);
    }
  };

  const handleBack = () => {
    router.push(`/dashboard/notebook/${notebookId}`);
  };

  const handleLogout = async () => {
    try {
      await logOut();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      alert('Error logging out. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-16">
      {/* Header with Back Button */}
      <div className="sticky top-0 bg-black border-b border-gray-800 z-10">
        <div className="flex items-center gap-4 p-4">
          <button
            onClick={handleBack}
            className="text-white hover:text-gray-400 text-xl font-bold"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold">More</h1>
        </div>
      </div>

      <div className="container mx-auto p-4 space-y-6">
        {/* Account and Theme Section - Compact */}
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Account</h2>
            <span className="text-xs text-gray-400">{user?.email || 'Not logged in'}</span>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Theme</h2>
            <div className="flex gap-1">
              {(['dark', 'light', 'purple', 'blue'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`w-8 h-8 rounded border transition-colors ${
                    theme === t
                      ? 'border-white scale-110'
                      : 'border-gray-700 hover:border-gray-600'
                  } ${
                    t === 'dark' ? 'bg-black' :
                    t === 'light' ? 'bg-white' :
                    t === 'purple' ? 'bg-purple-600' :
                    'bg-blue-600'
                  }`}
                  title={t.charAt(0).toUpperCase() + t.slice(1)}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Notebooks */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Notebooks</h2>
            <button
              onClick={async () => {
                const notebookName = prompt('Enter notebook name:');
                if (notebookName && notebookName.trim()) {
                  try {
                    const { createNotebook, createTab, createNote } = await import('@/lib/firebase/firestore');
                    const newNotebookId = await createNotebook({
                      userId: user!.uid,
                      name: notebookName.trim(),
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      isDefault: false,
                    });

                    // Create default tabs for new notebook
                    const STAPLE_NOTES = [
                      { name: 'Scratch', icon: '✏️', order: 1 },
                      { name: 'Now', icon: '⏰', order: 2 },
                      { name: 'Short-Term', icon: '📅', order: 3 },
                      { name: 'Long-term', icon: '📆', order: 4 },
                    ];

                    for (const staple of STAPLE_NOTES) {
                      await createNote({
                        userId: user!.uid,
                        notebookId: newNotebookId,
                        tabId: 'staple',
                        title: staple.name,
                        content: '',
                        contentPlain: '',
                        images: [],
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        isArchived: false,
                        deletedAt: null,
                      });

                      await createTab({
                        notebookId: newNotebookId,
                        name: staple.name,
                        icon: staple.icon,
                        order: staple.order,
                        isLocked: true,
                        isStaple: true,
                        createdAt: new Date(),
                      });
                    }

                    await createTab({
                      notebookId: newNotebookId,
                      name: 'All Notes',
                      icon: '📋',
                      order: 5,
                      isLocked: true,
                      isStaple: true,
                      createdAt: new Date(),
                    });

                    await createTab({
                      notebookId: newNotebookId,
                      name: 'More',
                      icon: '⋯',
                      order: 6,
                      isLocked: true,
                      isStaple: true,
                      createdAt: new Date(),
                    });

                    // Don't update current notebook preference - stay on current notebook
                    await loadNotebooks();
                    // Don't navigate - stay on More page
                  } catch (error) {
                    console.error('Error creating notebook:', error);
                    alert('Failed to create notebook');
                  }
                }
              }}
              className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-white text-xl"
              title="Create new notebook"
            >
              +
            </button>
          </div>
          {notebooks.length === 0 ? (
            <p className="text-gray-400 text-sm">No notebooks yet.</p>
          ) : (
            <div className="space-y-2">
              {notebooks.map((notebook) => (
                <div
                  key={notebook.id}
                  className={`block p-3 rounded transition-colors ${
                    notebook.id === notebookId
                      ? 'bg-blue-900/30 border-2 border-blue-600'
                      : 'bg-gray-800 hover:bg-gray-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Link
                        href={`/dashboard/notebook/${notebook.id}`}
                        className="block"
                      >
                        <h3 className="font-semibold">{notebook.name}</h3>
                        {notebook.isDefault && (
                          <p className="text-xs text-gray-400 mt-1">Default</p>
                        )}
                      </Link>
                    </div>
                    {!notebook.isDefault && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          if (confirm(`Set "${notebook.name}" as default notebook?`)) {
                            try {
                              const { updateNotebook, getNotebooks, updateUserPreferences } = await import('@/lib/firebase/firestore');
                              // Remove default from all notebooks
                              const allNotebooks = await getNotebooks(user!.uid);
                              for (const nb of allNotebooks) {
                                if (nb.isDefault) {
                                  await updateNotebook(nb.id, { isDefault: false });
                                }
                              }
                              // Set this notebook as default
                              await updateNotebook(notebook.id, { isDefault: true });
                              await updateUserPreferences(user!.uid, { currentNotebookId: notebook.id });
                              await loadNotebooks();
                            } catch (error) {
                              console.error('Error setting default notebook:', error);
                              alert('Failed to set default notebook');
                            }
                          }
                        }}
                        className="ml-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                        title="Set as default"
                      >
                        Make Default
                      </button>
                    )}
                    {notebook.isDefault && (
                      <span className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded">
                        Default
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storage Usage */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Storage Usage</h2>
          {user && <StorageUsageDisplay userId={user.uid} />}
        </div>

        {/* Sync Status */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Sync Status</h2>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-sm text-gray-400">Auto-syncing enabled</p>
          </div>
          <p className="text-xs text-gray-500 mb-2">Syncing to: Firebase Firestore</p>
          <p className="text-xs text-gray-500">Last saved: {new Date().toLocaleString()}</p>
        </div>

        {/* Search All Notes */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Search All Notes</h2>
          <button
            onClick={() => {
              // TODO: Implement global search
              alert('Global search coming soon');
            }}
            className="w-full px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Search All Notes
          </button>
        </div>

        {/* Export All Data */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Export All Data</h2>
          <button
            onClick={() => {
              // TODO: Implement export
              alert('Export feature coming soon');
            }}
            className="w-full px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Export Backup
          </button>
        </div>

        {/* Trash/Deleted Notes */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Trash</h2>
          <button
            onClick={async () => {
              try {
                const firestore = await import('@/lib/firebase/firestore');
                const deletedNotes = await firestore.getDeletedNotes(notebookId, user?.uid);
                
                if (deletedNotes.length === 0) {
                  alert('No deleted notes found');
                  return;
                }
                
                // For now, show in alert - TODO: create proper trash view page
                const noteList = deletedNotes.map((n: Note, i: number) => `${i + 1}. ${n.title || 'Untitled'} (Deleted: ${n.deletedAt?.toLocaleDateString()})`).join('\n');
                alert(`Deleted Notes (${deletedNotes.length}):\n\n${noteList}`);
              } catch (error) {
                console.error('Error loading deleted notes:', error);
                alert('Failed to load deleted notes');
              }
            }}
            className="w-full px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
          >
            View Deleted Notes
          </button>
          <p className="text-xs text-gray-500 mt-2">Notes deleted in the last 30 days</p>
        </div>

        {/* Settings */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Settings</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Auto-save</span>
              <span className="text-xs text-gray-500">Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Font Size</span>
              <span className="text-xs text-gray-500">Medium</span>
            </div>
          </div>
        </div>

        {/* About/Help */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">About</h2>
          <p className="text-sm text-gray-400 mb-2">Note App v1.0</p>
          <p className="text-xs text-gray-500">A simple note-taking app built with Next.js and Firebase</p>
        </div>
      </div>
    </div>
  );
}

