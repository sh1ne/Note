'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { logOut } from '@/lib/firebase/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { getNotebooks, getNotes, getNotebookBySlug } from '@/lib/firebase/firestore';
import { Notebook, Note } from '@/lib/types';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { createSlug } from '@/lib/utils/slug';

function StorageUsageDisplay({ userId, notebookId }: { userId: string; notebookId: string }) {
  const [usage, setUsage] = useState<{ notes: number; estimatedSize: string } | null>(null);

  useEffect(() => {
    if (userId && notebookId) {
      calculateStorage();
    }
  }, [userId, notebookId]);

  const calculateStorage = async () => {
    try {
      const notes = await getNotes(notebookId, undefined, userId);
      // Exclude staple notes and deleted notes from count
      const regularNotes = notes.filter((n) => n && n.tabId !== 'staple' && !n.deletedAt);
      // Rough estimate: each note ~1-5KB, images are stored separately
      const estimatedBytes = regularNotes.length * 3000; // 3KB average per note
      const estimatedMB = (estimatedBytes / (1024 * 1024)).toFixed(2);
      setUsage({
        notes: regularNotes.length,
        estimatedSize: estimatedMB,
      });
    } catch (error) {
      console.error('Error calculating storage:', error);
    }
  };

  if (!usage) {
    return (
      <>
        <p className="text-text-secondary text-sm">Calculating...</p>
        <p className="text-xs text-text-secondary mt-2">Estimating storage usage</p>
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">Notes:</span>
          <span className="text-sm text-text-primary font-semibold">{usage.notes}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">Estimated Size:</span>
          <span className="text-sm text-text-primary font-semibold">{usage.estimatedSize} MB</span>
        </div>
      </div>
      <p className="text-xs text-text-secondary mt-2">Note: This is an estimate. Images are stored separately.</p>
    </>
  );
}

export default function MorePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const notebookSlug = params.notebookSlug as string;
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [showDefaultConfirm, setShowDefaultConfirm] = useState<{ notebookId: string; notebookName: string } | null>(null);
  const [showDeletedNotes, setShowDeletedNotes] = useState(false);
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [autoSave, setAutoSave] = useState(true);

  // Look up notebook by slug
  useEffect(() => {
    const loadNotebook = async () => {
      if (!user || !notebookSlug) return;
      
      try {
        const notebook = await getNotebookBySlug(user.uid, notebookSlug);
        if (!notebook) {
          router.push('/');
          return;
        }
        setNotebookId(notebook.id);
      } catch (err) {
        console.error('Error loading notebook:', err);
        router.push('/');
      }
    };
    
    loadNotebook();
  }, [user, notebookSlug, router]);

  useEffect(() => {
    if (user) {
      loadNotebooks();
    }
    // Load font size and auto-save from localStorage
    if (typeof window !== 'undefined') {
      const savedFontSize = localStorage.getItem('fontSize') as 'small' | 'medium' | 'large' | null;
      const savedAutoSave = localStorage.getItem('autoSave');
      if (savedFontSize && ['small', 'medium', 'large'].includes(savedFontSize)) {
        setFontSize(savedFontSize);
        document.documentElement.setAttribute('data-font-size', savedFontSize);
      }
      if (savedAutoSave !== null) {
        setAutoSave(savedAutoSave === 'true');
      }
    }
  }, [user]);

  const loadNotebooks = async () => {
    if (!user) return;
    try {
      const data = await getNotebooks(user.uid);
      // Sort: default notebook first, then by name
      const sorted = [...data].sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });
      setNotebooks(sorted);
    } catch (error) {
      console.error('Error loading notebooks:', error);
    }
  };

  const handleBack = () => {
    router.push(`/${notebookSlug}`);
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

  if (!notebookId) {
    return <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pb-16">
      {/* Header with Back Button */}
      <div className="sticky top-0 bg-bg-primary border-b border-bg-secondary z-10">
        <div className="flex items-center gap-4 p-4">
          <button
            onClick={handleBack}
            className="text-text-primary hover:text-text-secondary text-xl font-bold"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold">More</h1>
        </div>
      </div>

      <div className="container mx-auto p-4 space-y-6">
        {/* Account and Theme Section - Compact */}
        <div className="bg-bg-secondary rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Account</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">{user?.email || 'Not logged in'}</span>
              <button
                onClick={handleLogout}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
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
        </div>

        {/* Notebooks */}
        <div className="bg-bg-secondary rounded-lg p-4">
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

                    // Get the new notebook to get its slug
                    const newNotebook = await getNotebookBySlug(user!.uid, createSlug(notebookName.trim()));
                    const newNotebookSlug = newNotebook?.slug || '';

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

                    await loadNotebooks();
                  } catch (error) {
                    console.error('Error creating notebook:', error);
                    alert('Failed to create notebook');
                  }
                }
              }}
              className="w-8 h-8 flex items-center justify-center bg-bg-secondary hover:bg-bg-secondary/80 rounded text-text-primary text-xl"
              title="Create new notebook"
            >
              +
            </button>
          </div>
          {notebooks.length === 0 ? (
            <p className="text-text-secondary text-sm">No notebooks yet.</p>
          ) : (
            <div className="space-y-2">
              {notebooks.map((notebook) => (
                <div
                  key={notebook.id}
                  className={`block p-3 rounded transition-colors ${
                    notebook.id === notebookId
                      ? 'bg-blue-900/30 border-2 border-blue-600'
                      : 'bg-bg-secondary hover:bg-bg-secondary/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Link
                        href={`/${notebook.slug}`}
                        className="block"
                      >
                        <h3 className="font-semibold">{notebook.name}</h3>
                        {notebook.isDefault && (
                          <p className="text-xs text-text-secondary mt-1">Default</p>
                        )}
                      </Link>
                    </div>
                    {!notebook.isDefault && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setShowDefaultConfirm({ notebookId: notebook.id, notebookName: notebook.name });
                        }}
                        className="ml-2 px-2 py-1 text-xs bg-bg-secondary hover:bg-bg-secondary/80 rounded text-text-primary"
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
        <div className="bg-bg-secondary rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Storage Usage</h2>
          {user && notebookId && <StorageUsageDisplay userId={user.uid} notebookId={notebookId} />}
        </div>

        {/* Sync Status */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Sync Status</h2>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-sm text-text-secondary">Auto-syncing enabled</p>
          </div>
          <p className="text-xs text-text-secondary mb-2">Syncing to: Firebase Firestore</p>
          <p className="text-xs text-text-secondary">Last saved: {new Date().toLocaleString()}</p>
        </div>

        {/* Search All Notes */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Search All Notes</h2>
          <button
            onClick={() => {
              alert('Global search coming soon');
            }}
            className="w-full px-4 py-2 bg-bg-secondary hover:bg-bg-secondary/80 text-text-primary rounded transition-colors"
          >
            Search All Notes
          </button>
        </div>

        {/* Export All Data */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Export All Data</h2>
          <button
            onClick={() => {
              alert('Export feature coming soon');
            }}
            className="w-full px-4 py-2 bg-bg-secondary hover:bg-bg-secondary/80 text-text-primary rounded transition-colors"
          >
            Export Backup
          </button>
        </div>

        {/* Trash/Deleted Notes */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Trash</h2>
            <button
              onClick={async () => {
                try {
                  const firestore = await import('@/lib/firebase/firestore');
                  const notes = await firestore.getDeletedNotes(notebookId, user?.uid);
                  setDeletedNotes(notes);
                  setShowDeletedNotes(true);
                } catch (error) {
                  console.error('Error loading deleted notes:', error);
                  alert('Failed to load deleted notes');
                }
              }}
              className="px-3 py-1 text-sm bg-bg-primary hover:bg-bg-primary/80 text-text-primary rounded transition-colors"
            >
              View Deleted Notes
            </button>
          </div>
          <p className="text-xs text-text-secondary">Notes deleted in the last 30 days</p>
        </div>

        {/* Settings */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Settings</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Auto-save</span>
              <button
                onClick={() => {
                  const newValue = !autoSave;
                  setAutoSave(newValue);
                  localStorage.setItem('autoSave', String(newValue));
                }}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  autoSave
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-700 text-text-secondary hover:bg-gray-600'
                }`}
              >
                {autoSave ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Font Size</span>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setFontSize(size);
                      localStorage.setItem('fontSize', size);
                      // Apply font size to document
                      document.documentElement.setAttribute('data-font-size', size);
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      fontSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-bg-primary text-text-secondary hover:bg-bg-primary/80'
                    }`}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* About/Help */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">About</h2>
          <p className="text-sm text-text-secondary mb-2">Note App v1.0</p>
          <p className="text-xs text-text-secondary">A simple note-taking app built with Next.js and Firebase</p>
        </div>
      </div>

      {/* Make Default Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!showDefaultConfirm}
        title="Set Default Notebook"
        message={`Set "${showDefaultConfirm?.notebookName}" as your default notebook?`}
        onConfirm={async () => {
          if (!showDefaultConfirm || !user) return;
          try {
            const { updateNotebook, getNotebooks, updateUserPreferences } = await import('@/lib/firebase/firestore');
            // Remove default from all notebooks
            const allNotebooks = await getNotebooks(user.uid);
            for (const nb of allNotebooks) {
              if (nb.isDefault) {
                await updateNotebook(nb.id, { isDefault: false });
              }
            }
            // Set this notebook as default
            await updateNotebook(showDefaultConfirm.notebookId, { isDefault: true });
            await updateUserPreferences(user.uid, { currentNotebookId: showDefaultConfirm.notebookId });
            await loadNotebooks();
            setShowDefaultConfirm(null);
          } catch (error) {
            console.error('Error setting default notebook:', error);
            alert('Failed to set default notebook');
            setShowDefaultConfirm(null);
          }
        }}
        onCancel={() => setShowDefaultConfirm(null)}
        confirmText="Set Default"
        cancelText="Cancel"
      />

      {/* Deleted Notes Dialog */}
      {showDeletedNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-bg-secondary rounded-lg p-6 max-w-2xl w-full mx-4 border border-bg-secondary max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">Deleted Notes ({deletedNotes.length})</h3>
              <button
                onClick={() => {
                  setShowDeletedNotes(false);
                  setDeletedNotes([]);
                }}
                className="text-text-secondary hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {deletedNotes.length === 0 ? (
                <p className="text-text-secondary text-center py-8">No deleted notes found</p>
              ) : (
                <div className="space-y-2">
                  {deletedNotes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 bg-bg-primary rounded border border-bg-secondary"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-text-primary">{note.title || 'Untitled'}</h4>
                          <p className="text-xs text-text-secondary mt-1">
                            Deleted: {note.deletedAt?.toLocaleDateString()} {note.deletedAt?.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

