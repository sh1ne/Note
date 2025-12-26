'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { logOut } from '@/lib/firebase/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { getNotebooks, getNotes, getNotebookBySlug, createNote, createTab, deleteNotebook, updateUserPreferences } from '@/lib/firebase/firestore';
import { Notebook, Note } from '@/lib/types';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Toast from '@/components/common/Toast';
import { createSlug } from '@/lib/utils/slug';
import BottomNav from '@/components/layout/BottomNav';
import { useTabs } from '@/hooks/useTabs';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { generateUniqueNoteTitle } from '@/lib/utils/noteHelpers';

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
        <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-secondary">Notes:</span>
          <span className="text-sm text-text-primary font-semibold">{usage.notes}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-secondary">Estimated Size:</span>
          <span className="text-sm text-text-primary font-semibold">{usage.estimatedSize} MB</span>
        </div>
      </div>
    </>
  );
}

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 10) {
    return 'Just now';
  } else if (diffSecs < 60) {
    return `${diffSecs}s ago`;
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
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
  const [showDeleteNotebookConfirm, setShowDeleteNotebookConfirm] = useState<{ notebookId: string; notebookName: string } | null>(null);
  const [showDeletedNotes, setShowDeletedNotes] = useState(false);
  const [showCreateNotebookDialog, setShowCreateNotebookDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState<{ notebookId: string; currentName: string } | null>(null);
  const [notebookNameInput, setNotebookNameInput] = useState('');
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStartTime, setSyncStartTime] = useState<Date | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncDuration, setSyncDuration] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showDeletePermanentConfirm, setShowDeletePermanentConfirm] = useState<{ noteId: string; noteTitle: string } | null>(null);

  // Use tabs for bottom navigation
  const { tabs, activeTabId, setActiveTabId, getTabById, refreshTabs } = useTabs({ 
    notebookId: notebookId || '',
    defaultTabName: 'More'
  });

  const { navigateToTab } = useTabNavigation({
    notebookId: notebookId || '',
    notebookSlug: notebookSlug,
    userId: user?.uid || '',
  });

  // Set "More" tab as active when page loads
  useEffect(() => {
    if (tabs.length > 0 && notebookId) {
      const moreTab = tabs.find(tab => tab.name === 'More');
      if (moreTab) {
        setActiveTabId(moreTab.id);
      }
    }
  }, [tabs, notebookId, setActiveTabId]);

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
      loadLastSyncTime();
      loadUserPreferences();
    }
  }, [user]);

  const loadUserPreferences = async () => {
    if (!user) return;
    try {
      const { getUserPreferences } = await import('@/lib/firebase/firestore');
      const prefs = await getUserPreferences(user.uid);
      if (prefs?.fontSize && ['small', 'medium', 'large'].includes(prefs.fontSize)) {
        setFontSize(prefs.fontSize);
        document.documentElement.setAttribute('data-font-size', prefs.fontSize);
      } else {
        // Fallback to localStorage
    if (typeof window !== 'undefined') {
      const savedFontSize = localStorage.getItem('fontSize') as 'small' | 'medium' | 'large' | null;
      if (savedFontSize && ['small', 'medium', 'large'].includes(savedFontSize)) {
        setFontSize(savedFontSize);
        document.documentElement.setAttribute('data-font-size', savedFontSize);
            // Sync to Firestore
            await updateUserPreferences(user.uid, { fontSize: savedFontSize });
          }
        }
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        const savedFontSize = localStorage.getItem('fontSize') as 'small' | 'medium' | 'large' | null;
        if (savedFontSize && ['small', 'medium', 'large'].includes(savedFontSize)) {
          setFontSize(savedFontSize);
          document.documentElement.setAttribute('data-font-size', savedFontSize);
        }
      }
    }
  };

  const loadLastSyncTime = () => {
    if (typeof window !== 'undefined') {
      const lastSync = localStorage.getItem('lastSyncTime');
      if (lastSync) {
        setLastSyncTime(new Date(parseInt(lastSync)));
      }
      setIsOnline(navigator.onLine);
    }
  };

  // Monitor online/offline status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
      setSyncError(null);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check sync queue and listen for sync events
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    
    const checkSyncQueue = async () => {
      try {
        const { getSyncQueue } = await import('@/lib/utils/localStorage');
        const queue = await getSyncQueue();
        // Include test items in count for testing purposes (they'll be skipped during actual sync)
        // This allows the Test Pending button to work properly
        setPendingSyncCount(queue.length);
        // Filter out test items only for clearing sync start time
        const realQueueItems = queue.filter(item => !item.noteId.startsWith('test-pending-'));
        // Don't set isSyncing based on queue - only sync events should control that
        // Only clear sync start time if queue is empty
        if (realQueueItems.length === 0 && syncStartTime && !isSyncing) {
          setSyncStartTime(null);
        }
      } catch (error) {
        console.error('Error checking sync queue:', error);
      }
    };

    // Verify sync connection on mount by checking if we can read from Firestore
    const verifySyncConnection = async () => {
      try {
        // Just check if we can access Firestore - this verifies connection
        const { getNotes } = await import('@/lib/firebase/firestore');
        if (notebookId && user) {
          // Try to read notes (lightweight operation to verify connection)
          await getNotes(notebookId, undefined, user.uid);
          // If successful and no sync history, set a connection verified timestamp
          if (!lastSyncTime) {
            // Don't set lastSyncTime, but we know connection works
            // The actual sync will happen when notes are edited
          }
        }
      } catch (error) {
        console.error('Error verifying sync connection:', error);
        setSyncError('Cannot connect to cloud. Check your internet connection.');
      }
    };

    const handleSyncStart = () => {
      setIsSyncing(true);
      if (!syncStartTime) {
        setSyncStartTime(new Date());
      }
    };

    const handleSync = () => {
      const now = Date.now();
      localStorage.setItem('lastSyncTime', now.toString());
      setLastSyncTime(new Date(now));
      setIsSyncing(false);
      setSyncStartTime(null);
      setSyncError(null); // Clear any errors on successful sync
      // Check queue after a brief delay to allow queue to update
      setTimeout(() => {
        checkSyncQueue();
      }, 100);
    };

    const handleSyncError = (event: Event) => {
      const customEvent = event as CustomEvent;
      const error = customEvent.detail?.error;
      // Don't show error for test items
      if (customEvent.detail?.noteId?.startsWith('test-pending-')) {
        console.log('[Sync] Ignoring error for test item');
        return;
      }
      setSyncError(`Failed to sync note. Will retry automatically.`);
    };

    // Listen for custom sync events
    window.addEventListener('note-syncing', handleSyncStart);
    window.addEventListener('note-synced', handleSync);
    window.addEventListener('note-sync-error', handleSyncError);
    
    // Check sync queue and last sync time periodically
    checkSyncQueue();
    verifySyncConnection(); // Verify connection on mount
    
    const interval = setInterval(() => {
      checkSyncQueue();
      const lastSync = localStorage.getItem('lastSyncTime');
      if (lastSync) {
        setLastSyncTime(new Date(parseInt(lastSync)));
      }
    }, 2000); // Check every 2 seconds

    return () => {
      window.removeEventListener('note-syncing', handleSyncStart);
      window.removeEventListener('note-synced', handleSync);
      window.removeEventListener('note-sync-error', handleSyncError);
      clearInterval(interval);
    };
  }, [syncStartTime, notebookId, user, lastSyncTime]);

  // Update sync duration timer when syncing
  useEffect(() => {
    if (!isSyncing || !syncStartTime) {
      setSyncDuration(0);
      return;
    }

    const timer = setInterval(() => {
      setSyncDuration(Math.floor((Date.now() - syncStartTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [isSyncing, syncStartTime]);


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

  const handleCreateNotebook = async () => {
    if (!notebookNameInput.trim() || !user) return;
    
                  try {
                    const { createNotebook, createTab, createNote } = await import('@/lib/firebase/firestore');
                    const newNotebookId = await createNotebook({
        userId: user.uid,
        name: notebookNameInput.trim(),
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      isDefault: false,
                    });

                    // Get the new notebook to get its slug
      const newNotebook = await getNotebookBySlug(user.uid, createSlug(notebookNameInput.trim()));
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
          userId: user.uid,
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
      setShowCreateNotebookDialog(false);
      setNotebookNameInput('');
                  } catch (error) {
                    console.error('Error creating notebook:', error);
                    alert('Failed to create notebook');
                  }
  };

  const handleRenameNotebook = async () => {
    if (!showRenameDialog || !notebookNameInput.trim() || notebookNameInput.trim() === showRenameDialog.currentName || !user) return;
    
    try {
      const { updateNotebook } = await import('@/lib/firebase/firestore');
      await updateNotebook(showRenameDialog.notebookId, { name: notebookNameInput.trim() });
      await loadNotebooks();
      
      // If this is the current notebook, redirect to new slug
      if (showRenameDialog.notebookId === notebookId) {
        const updatedNotebooks = await getNotebooks(user.uid);
        const updatedNotebook = updatedNotebooks.find(nb => nb.id === showRenameDialog.notebookId);
        if (updatedNotebook) {
          router.push(`/${updatedNotebook.slug}/more`);
        }
      }
      
      setShowRenameDialog(null);
      setNotebookNameInput('');
    } catch (error) {
      console.error('Error renaming notebook:', error);
      alert('Failed to rename notebook');
    }
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
        {/* Account and Theme Section */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Account</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">{user?.email || 'Not logged in'}</span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Theme</h2>
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
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-text-primary">Font Size</span>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={async () => {
                    setFontSize(size);
                    // Apply font size to document
                    document.documentElement.setAttribute('data-font-size', size);
                    // Save to Firestore
                    if (user) {
                      try {
                        const { updateUserPreferences } = await import('@/lib/firebase/firestore');
                        await updateUserPreferences(user.uid, { fontSize: size });
                      } catch (error) {
                        console.error('Error saving font size to Firestore:', error);
                        // Fallback to localStorage
                        localStorage.setItem('fontSize', size);
                      }
                    } else {
                      localStorage.setItem('fontSize', size);
                    }
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Version</span>
            <span className="text-sm text-text-secondary">v0.1.0</span>
          </div>
        </div>

        {/* Notebooks */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Notebooks</h2>
            <button
              onClick={() => {
                setNotebookNameInput('');
                setShowCreateNotebookDialog(true);
              }}
              className="w-8 h-8 flex items-center justify-center bg-green-600 hover:bg-green-700 rounded text-white text-xl transition-colors"
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setNotebookNameInput(notebook.name);
                          setShowRenameDialog({ notebookId: notebook.id, currentName: notebook.name });
                        }}
                        className="px-3 py-1 text-xs bg-bg-primary hover:bg-bg-primary/80 rounded text-text-primary transition-colors"
                        title="Rename notebook"
                      >
                        Rename
                      </button>
                    {!notebook.isDefault && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setShowDefaultConfirm({ notebookId: notebook.id, notebookName: notebook.name });
                        }}
                          className="px-3 py-1 text-xs bg-bg-primary hover:bg-bg-primary/80 rounded text-text-primary transition-colors"
                        title="Set as default"
                      >
                        Make Default
                      </button>
                    )}
                    {notebook.isDefault && (
                        <span className="px-3 py-1 text-xs bg-blue-600 text-white rounded">
                        Default
                      </span>
                    )}
                      {!notebook.isDefault && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setShowDeleteNotebookConfirm({ notebookId: notebook.id, notebookName: notebook.name });
                          }}
                          className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                          title="Delete notebook"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storage Usage */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">
            Storage Usage{' '}
            <span className="text-xs text-text-secondary font-normal">(Note: This is an estimate. Images are stored separately.)</span>
          </h2>
          {user && notebookId && <StorageUsageDisplay userId={user.uid} notebookId={notebookId} />}
        </div>

        {/* Sync Status */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Sync Status (Auto Syncs to Firebase Firestore Cloud)</h2>
            {isSyncing && syncStartTime ? (
              <span className="text-xs text-text-secondary">
                Syncing... {syncDuration}s
              </span>
            ) : lastSyncTime ? (
              <span className="text-xs text-text-secondary">
                Last synced: {formatRelativeTime(lastSyncTime)}
              </span>
            ) : (
              <span className="text-xs text-text-secondary">Will sync when you edit notes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              !isOnline
                ? 'bg-red-500 animate-pulse'
                : isSyncing 
                ? 'bg-yellow-500 animate-pulse' 
                : pendingSyncCount > 0
                ? 'bg-orange-500 animate-pulse'
                : lastSyncTime
                ? 'bg-green-500'
                : pendingSyncCount === 0
                ? 'bg-gray-500'
                : 'bg-orange-500 animate-pulse'
            }`}></div>
            <p className="text-sm text-text-secondary">
              {!isOnline
                ? 'Offline - saved locally only'
                : isSyncing 
                ? 'Syncing...' 
                : pendingSyncCount > 0
                ? `${pendingSyncCount} pending`
                : lastSyncTime
                ? 'All changes saved'
                : 'Ready - will sync when you edit notes'}
            </p>
        </div>
          {!isOnline && (
            <div className="mt-2 p-2 bg-red-900/30 border border-red-600 rounded">
              <p className="text-xs text-red-300 font-semibold">⚠️ You're offline</p>
              <p className="text-xs text-red-200 mt-1">
                Your notes are being saved locally and will sync to the cloud when you're back online. 
                <strong> Your data is safe</strong> - nothing will be lost.
              </p>
            </div>
          )}
          {pendingSyncCount > 0 && !isSyncing && isOnline && (
            <p className="text-xs text-orange-400 mt-2">
              {pendingSyncCount} note{pendingSyncCount !== 1 ? 's' : ''} waiting to sync
            </p>
          )}
          {syncError && isOnline && (
            <p className="text-xs text-red-400 mt-2">
              Sync error: {syncError}
            </p>
          )}
          
          {/* Sync Testing Panel - Development Only */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 pt-4 border-t border-bg-primary">
              <summary className="cursor-pointer text-sm font-semibold text-yellow-400 hover:text-yellow-300 mb-3">
                🧪 Sync Testing & Edge Cases (Dev Only)
              </summary>
              <div className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      const { addToSyncQueue, getSyncQueue } = await import('@/lib/utils/localStorage');
                      const testNoteId = 'test-pending-' + Date.now();
                      await addToSyncQueue(testNoteId, {
                        title: 'Test Pending Note',
                        content: 'This is a test to verify pending sync state',
                      });
                      const queue = await getSyncQueue();
                      setPendingSyncCount(queue.length);
                      setToast({ message: `Test item added. Queue: ${queue.length}`, type: 'info' });
                      setTimeout(() => setToast(null), 2000);
                    }}
                    className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
                  >
                    Add Test Item
                  </button>
                  
                  <button
                    onClick={async () => {
                      if (!notebookId || !user) {
                        setToast({ message: 'No notebook or user found', type: 'error' });
                        setTimeout(() => setToast(null), 2000);
                        return;
                      }
                      const { getNotes } = await import('@/lib/firebase/firestore');
                      const { addToSyncQueue, getSyncQueue } = await import('@/lib/utils/localStorage');
                      const notes = await getNotes(notebookId, undefined, user.uid);
                      if (notes.length === 0) {
                        setToast({ message: 'No notes found to test with', type: 'error' });
                        setTimeout(() => setToast(null), 2000);
                        return;
                      }
                      const testNote = notes[0];
                      // Add a real note to queue (simulates a failed sync)
                      console.log('[Sync Test] Adding real note to queue:', {
                        noteId: testNote.id,
                        title: testNote.title,
                        notebookId: testNote.notebookId,
                      });
                      await addToSyncQueue(testNote.id, {
                        title: testNote.title,
                        content: testNote.content + ' [QUEUED FOR TEST]',
                        contentPlain: testNote.contentPlain + ' [QUEUED FOR TEST]',
                      });
                      const queue = await getSyncQueue();
                      setPendingSyncCount(queue.length);
                      console.log('[Sync Test] Queue after adding real note:', queue.length, 'items');
                      setToast({ message: `Real note "${testNote.title}" added to queue. Will sync to Firebase!`, type: 'info' });
                      setTimeout(() => setToast(null), 3000);
                    }}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Add Real Note to Queue
                  </button>
                  
                  <button
                    onClick={async () => {
                      const { getSyncQueue } = await import('@/lib/utils/localStorage');
                      const queue = await getSyncQueue();
                      const queueInfo = queue.map(item => ({
                        noteId: item.noteId,
                        title: item.data.title || 'Untitled',
                        isTest: item.noteId.startsWith('test-pending-'),
                      }));
                      console.log('[Sync Test] Queue contents:', queueInfo);
                      setToast({ 
                        message: `Queue: ${queue.length} items (${queueInfo.filter(i => !i.isTest).length} real, ${queueInfo.filter(i => i.isTest).length} test). Check console for details.`, 
                        type: 'info' 
                      });
                      setTimeout(() => setToast(null), 4000);
                    }}
                    className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                  >
                    View Queue Contents
                  </button>
                  
                  <button
                    onClick={async () => {
                      const { getSyncQueue, removeFromSyncQueue } = await import('@/lib/utils/localStorage');
                      const queue = await getSyncQueue();
                      for (const item of queue) {
                        await removeFromSyncQueue(item.noteId);
                      }
                      setPendingSyncCount(0);
                      setToast({ message: 'Queue cleared!', type: 'success' });
                      setTimeout(() => setToast(null), 2000);
                    }}
                    className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                  >
                    Clear Queue
                  </button>
                  
                  <button
                    onClick={async () => {
                      try {
                        const { getNotes } = await import('@/lib/firebase/firestore');
                        if (!notebookId || !user) {
                          setToast({ message: 'No notebook or user found', type: 'error' });
                          setTimeout(() => setToast(null), 2000);
                          return;
                        }
                        const startTime = Date.now();
                        await getNotes(notebookId, undefined, user.uid);
                        const duration = Date.now() - startTime;
                        setToast({ message: `✅ Firebase connected! Response time: ${duration}ms`, type: 'success' });
                        setTimeout(() => setToast(null), 3000);
                      } catch (error: any) {
                        setToast({ message: `❌ Firebase error: ${error.message}`, type: 'error' });
                        setTimeout(() => setToast(null), 3000);
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                  >
                    Test Firebase Connection
                  </button>
                  
                  <button
                    onClick={async () => {
                      if (!notebookId || !user) {
                        setToast({ message: 'No notebook or user found', type: 'error' });
                        setTimeout(() => setToast(null), 2000);
                        return;
                      }
                      const { getNotes } = await import('@/lib/firebase/firestore');
                      const notes = await getNotes(notebookId, undefined, user.uid);
                      const firestoreNoteIds = new Set(notes.map(n => n.id));
                      const { getSyncQueue } = await import('@/lib/utils/localStorage');
                      const queue = await getSyncQueue();
                      const realQueueItems = queue.filter(item => !item.noteId.startsWith('test-pending-'));
                      const validItems = realQueueItems.filter(item => firestoreNoteIds.has(item.noteId));
                      const invalidItems = realQueueItems.filter(item => !firestoreNoteIds.has(item.noteId));
                      
                      console.log('[Sync Test] Queue validation:', {
                        total: queue.length,
                        real: realQueueItems.length,
                        valid: validItems.length,
                        invalid: invalidItems.length,
                        invalidNoteIds: invalidItems.map(i => i.noteId),
                      });
                      
                      setToast({ 
                        message: `Queue: ${realQueueItems.length} real items (${validItems.length} valid, ${invalidItems.length} invalid). Check console.`, 
                        type: invalidItems.length > 0 ? 'error' : 'info' 
                      });
                      setTimeout(() => setToast(null), 4000);
                    }}
                    className="px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
                  >
                    Validate Queue vs Firebase
                  </button>
                  
                  <button
                    onClick={async () => {
                      const { addToSyncQueue, getSyncQueue } = await import('@/lib/utils/localStorage');
                      // Add a note with an invalid/fake ID that doesn't exist in Firebase
                      const invalidNoteId = 'invalid-note-id-' + Date.now();
                      console.log('[Sync Test] Adding invalid note ID to queue:', invalidNoteId);
                      await addToSyncQueue(invalidNoteId, {
                        title: 'Invalid Note (Test)',
                        content: 'This note ID does not exist in Firebase',
                        contentPlain: 'This note ID does not exist in Firebase',
                      });
                      const queue = await getSyncQueue();
                      setPendingSyncCount(queue.length);
                      console.log('[Sync Test] Invalid note added. Queue:', queue.length, 'items');
                      setToast({ 
                        message: `Invalid note ID added to queue. It will fail to sync (expected). Check console.`, 
                        type: 'info' 
                      });
                      setTimeout(() => setToast(null), 4000);
                    }}
                    className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                  >
                    Add Invalid Note ID
                  </button>
                  
                  <button
                    onClick={async () => {
                      if (!notebookId || !user) {
                        setToast({ message: 'No notebook or user found', type: 'error' });
                        setTimeout(() => setToast(null), 2000);
                        return;
                      }
                      const { getNotes } = await import('@/lib/firebase/firestore');
                      const { addToSyncQueue, getSyncQueue } = await import('@/lib/utils/localStorage');
                      const notes = await getNotes(notebookId, undefined, user.uid);
                      if (notes.length === 0) {
                        setToast({ message: 'No notes found to test with', type: 'error' });
                        setTimeout(() => setToast(null), 2000);
                        return;
                      }
                      // Add multiple notes to queue (up to 5)
                      const notesToQueue = notes.slice(0, Math.min(5, notes.length));
                      console.log('[Sync Test] Adding multiple notes to queue:', notesToQueue.length);
                      for (const note of notesToQueue) {
                        await addToSyncQueue(note.id, {
                          title: note.title + ' [MULTI-TEST]',
                          content: note.content + ' [MULTI-TEST]',
                          contentPlain: note.contentPlain + ' [MULTI-TEST]',
                        });
                      }
                      const queue = await getSyncQueue();
                      setPendingSyncCount(queue.length);
                      console.log('[Sync Test] Multiple notes added. Queue:', queue.length, 'items');
                      setToast({ 
                        message: `Added ${notesToQueue.length} notes to queue. They will sync one by one.`, 
                        type: 'info' 
                      });
                      setTimeout(() => setToast(null), 3000);
                    }}
                    className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                  >
                    Add Multiple Notes
                  </button>
                </div>
                
                <div className="text-xs text-text-secondary space-y-1 pt-2 border-t border-bg-primary">
                  <p><strong>Test Scenarios:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Add Test Item:</strong> Adds fake item (won't sync to Firebase, auto-removed after 30s)</li>
                    <li><strong>Add Real Note:</strong> Adds actual note to queue (WILL sync to Firebase when processed) - Check console for logs</li>
                    <li><strong>Add Invalid Note ID:</strong> Adds note with fake ID (will fail to sync - tests error handling)</li>
                    <li><strong>Add Multiple Notes:</strong> Adds up to 5 notes to queue (tests multiple pending items)</li>
                    <li><strong>View Queue:</strong> Shows queue contents in console</li>
                    <li><strong>Clear Queue:</strong> Removes all items from queue</li>
                    <li><strong>Test Firebase:</strong> Verifies connection to Firestore</li>
                    <li><strong>Validate Queue:</strong> Checks if queued note IDs exist in Firebase</li>
                  </ul>
                  <p className="mt-2 text-yellow-400"><strong>💡 Tip:</strong> Go offline in DevTools (Network tab → Offline) then edit a note. The pending count will show in the note editor header!</p>
                </div>
              </div>
            </details>
          )}
          
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-bg-primary">
            <details className="text-xs">
              <summary className="text-text-secondary cursor-pointer hover:text-text-primary">
                Sync Details
              </summary>
              <div className="mt-2 space-y-1 text-text-secondary pl-2 border-l-2 border-bg-primary">
                <p><strong>When:</strong> 2.5s after typing stops, immediately when switching tabs, or when closing app</p>
                <p><strong>Queue processing:</strong> Every 30 seconds, or when coming online</p>
                <p><strong>Storage:</strong> Firebase Firestore (cloud) + IndexedDB (local cache)</p>
                <p><strong>Offline:</strong> Notes save locally immediately, queue syncs when online</p>
                <p className="mt-2 pt-2 border-t border-bg-primary">
                  <strong>Verify sync:</strong> Check browser console (F12) for <code className="text-xs bg-bg-primary px-1 rounded">[Firestore]</code> logs, or check Firebase Console → Firestore Database → <code className="text-xs bg-bg-primary px-1 rounded">notes</code> collection
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  <strong>Test pending:</strong> Go offline (DevTools → Network → Offline), edit a note, then go back online to see pending queue
                </p>
              </div>
            </details>
            <div className="flex items-center gap-2">
              {/* Test Pending Button - Only in development */}
              {process.env.NODE_ENV === 'development' && (
          <button
                  onClick={async () => {
                    // Add a test item to sync queue to verify pending state
                    const { addToSyncQueue, getSyncQueue } = await import('@/lib/utils/localStorage');
                    const testNoteId = 'test-pending-' + Date.now();
                    await addToSyncQueue(testNoteId, {
                      title: 'Test Pending Note',
                      content: 'This is a test to verify pending sync state',
                    });
                    console.log('[Test] Added test item to sync queue. Check "More" page to see pending count.');
                    // Refresh queue count - include test items for testing
                    const queue = await getSyncQueue();
                    // Set count including test items so we can see the pending state
                    setPendingSyncCount(queue.length);
                    // Use setTimeout to ensure state update happens after any useEffect
                    setTimeout(async () => {
                      const updatedQueue = await getSyncQueue();
                      setPendingSyncCount(updatedQueue.length);
                    }, 100);
                    alert(`Test item added to sync queue. Pending count: ${queue.length}\n\nTo remove it, click "Sync Now" or clear it from browser DevTools > Application > IndexedDB > notes-db > syncQueue`);
            }}
                  className="px-3 py-1 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
                  title="Add test item to sync queue (dev only)"
                >
                  Test Pending
          </button>
              )}
          <button
                onClick={async () => {
                  setIsManualSyncing(true);
                  setSyncError(null);
                  try {
                    // Force process sync queue
                    const { getSyncQueue, removeFromSyncQueue } = await import('@/lib/utils/localStorage');
                    const { updateNote } = await import('@/lib/firebase/firestore');
                    
                    const queue = await getSyncQueue();
                    console.log('[Manual Sync] Processing queue:', queue.length, 'items');
                    let syncedCount = 0;
                    
                    for (const item of queue) {
                      try {
                        // Skip test items (they'll fail, but that's ok for testing)
                        if (item.noteId.startsWith('test-pending-')) {
                          console.log('[Manual Sync] Skipping test item:', item.noteId);
                          await removeFromSyncQueue(item.noteId);
                          continue;
                        }
                        
                        await updateNote(item.noteId, item.data);
                        await removeFromSyncQueue(item.noteId);
                        syncedCount++;
                        // Trigger sync event
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new Event('note-synced'));
                        }
                      } catch (error) {
                        console.error(`Error syncing item ${item.noteId}:`, error);
                        setSyncError(`Failed to sync ${queue.length - syncedCount} note(s)`);
                      }
                    }
                    
                    if (syncedCount > 0) {
                      const now = Date.now();
                      localStorage.setItem('lastSyncTime', now.toString());
                      setLastSyncTime(new Date(now));
                      console.log('[Manual Sync] ✅ Synced', syncedCount, 'items');
                    }
                    
                    // Also trigger a sync event to update UI
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new Event('note-synced'));
                    }
                    
                    // Refresh queue count
                    const updatedQueue = await getSyncQueue();
                    setPendingSyncCount(updatedQueue.length);
                    
                    if (updatedQueue.length === 0 && syncedCount > 0) {
                      // Show success briefly
                      setTimeout(() => {
                        setIsManualSyncing(false);
                      }, 1000);
                    } else {
                      setIsManualSyncing(false);
                    }
                  } catch (error) {
                    console.error('Error during manual sync:', error);
                    setSyncError('Sync failed. Please try again.');
                    setIsManualSyncing(false);
                  }
                }}
                disabled={isManualSyncing || !isOnline}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  isSyncing || isManualSyncing
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isManualSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
            </div>
          </div>
        </div>

         {/* Export All Data */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
             <h2 className="text-lg font-semibold">Export All Data</h2>
           </div>
           <div className="flex items-center justify-between">
             <p className="text-xs text-text-secondary">
               Download complete backup as JSON file. <span className="text-green-500">✓</span> Your data is automatically synced to the cloud (Firestore) for cross-device access.
             </p>
            <button
              onClick={async () => {
                 if (!user) return;
                try {
                   const { getNotebooks } = await import('@/lib/firebase/firestore');
                   const { getTabs } = await import('@/lib/firebase/firestore');
                   const { getNotes } = await import('@/lib/firebase/firestore');
                   
                   const notebooks = await getNotebooks(user.uid);
                   const exportData = {
                     version: '0.1.0',
                     exportDate: new Date().toISOString(),
                     userId: user.uid,
                     notebooks: await Promise.all(
                       notebooks.map(async (notebook) => {
                         const tabs = await getTabs(notebook.id);
                         const notes = await getNotes(notebook.id, undefined, user.uid);
                         return {
                           ...notebook,
                           tabs,
                           notes,
                         };
                       })
                     ),
                   };

                   const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                   const url = URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = `note-app-backup-${new Date().toISOString().split('T')[0]}.json`;
                   document.body.appendChild(a);
                   a.click();
                   document.body.removeChild(a);
                   URL.revokeObjectURL(url);
                } catch (error) {
                   console.error('Error exporting data:', error);
                   alert('Failed to export data. Please try again.');
                }
              }}
               className="px-3 py-1 text-xs bg-bg-primary hover:bg-bg-primary/80 text-text-primary rounded transition-colors whitespace-nowrap ml-2"
            >
               Download Backup
            </button>
          </div>
        </div>

         {/* Trash/Deleted Notes */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Trash</h2>
            <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Notes deleted in the last 30 days</span>
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
              className="px-3 py-1 text-xs bg-bg-primary hover:bg-bg-primary/80 text-text-primary rounded transition-colors"
            >
              View Deleted Notes
                  </button>
          </div>
        </div>

        {/* Delete All Notes & Cleanup */}
        <div className="bg-bg-secondary rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Cleanup & Maintenance</h2>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs text-text-secondary mb-1">
                Permanently delete all notes and clean up orphaned tabs from Firestore and local storage. <span className="text-red-400 font-semibold">This cannot be undone!</span>
              </p>
            </div>
            <button
              onClick={async () => {
                if (!user) return;
                
                const confirmed = window.confirm(
                  '⚠️ WARNING: This will permanently delete ALL your notes and clean up orphaned tabs.\n\n' +
                  'This includes:\n' +
                  '- All notes in Firestore\n' +
                  '- All orphaned tabs (tabs with no notes or from deleted notebooks)\n' +
                  '- All notes in local IndexedDB\n' +
                  '- All items in sync queue\n\n' +
                  'Staple tabs (Scratch, Now, etc.) will be preserved.\n\n' +
                  'This action CANNOT be undone!\n\n' +
                  'Click OK to proceed, or Cancel to abort.'
                );
                
                if (!confirmed) return;
                
                try {
                  // Delete from Firestore
                  const { deleteAllNotesForUser, deleteAllTabsForUser, cleanupOrphanedTabs } = await import('@/lib/firebase/firestore');
                  const deletedNotesCount = await deleteAllNotesForUser(user.uid);
                  console.log(`✅ Deleted ${deletedNotesCount} notes from Firestore`);
                  
                  // Delete non-staple tabs (keep staple tabs like Scratch, Now, etc.)
                  const deletedTabsCount = await deleteAllTabsForUser(user.uid, true);
                  console.log(`✅ Deleted ${deletedTabsCount} non-staple tabs from Firestore`);
                  
                  // Also clean up any orphaned tabs
                  const cleanupResult = await cleanupOrphanedTabs(user.uid);
                  console.log(`✅ Cleaned up ${cleanupResult.deleted} orphaned tabs`);
                  
                  // Recreate staple notes (they were deleted but tabs still exist)
                  console.log('🔄 Recreating staple notes...');
                  const { createNote } = await import('@/lib/firebase/firestore');
                  const stapleNotes = [
                    { name: 'Scratch', icon: '✏️' },
                    { name: 'Now', icon: '⏰' },
                    { name: 'Short-Term', icon: '📅' },
                    { name: 'Long-term', icon: '📆' },
                  ];
                  
                  for (const staple of stapleNotes) {
                    try {
                      await createNote({
                        userId: user.uid,
                        notebookId: notebookId || '',
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
                      console.log(`✅ Recreated staple note: ${staple.name}`);
                    } catch (error) {
                      console.error(`Error recreating staple note ${staple.name}:`, error);
                    }
                  }
                  
                  // Clear local storage
                  const { getDB } = await import('@/lib/utils/localStorage');
                  const database = await getDB();
                  
                  // Delete all local notes
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
                  
                  // Clear lastSyncTime
                  localStorage.removeItem('lastSyncTime');
                  
                  alert(
                    `✅ Cleanup complete!\n\n` +
                    `- Deleted ${deletedNotesCount} notes from Firestore\n` +
                    `- Deleted ${deletedTabsCount} non-staple tabs from Firestore\n` +
                    `- Cleaned up ${cleanupResult.deleted} orphaned tabs\n` +
                    `- Cleared ${localNotes.length} notes from local storage\n` +
                    `- Cleared ${syncQueue.length} items from sync queue\n\n` +
                    `(Staple tabs like Scratch, Now, etc. were kept)\n\n` +
                    `Please refresh the page.`
                  );
                  
                  // Refresh the page
                  window.location.reload();
                } catch (error) {
                  console.error('Error deleting all notes:', error);
                  alert('Error deleting notes. Check console for details.');
                }
              }}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors whitespace-nowrap font-bold"
              title="Delete all notes and cleanup tabs"
            >
              Delete All Notes
            </button>
          </div>
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

      <ConfirmDialog
        isOpen={!!showDeleteNotebookConfirm}
        title="Delete Notebook"
        message={`Are you sure you want to delete "${showDeleteNotebookConfirm?.notebookName}"? This will permanently delete the notebook and all its notes. This action cannot be undone.`}
        onConfirm={async () => {
          if (!showDeleteNotebookConfirm || !user) return;
          try {
            const deletedNotebookId = showDeleteNotebookConfirm.notebookId;
            
            // Delete the notebook (this will also delete all notes and tabs)
            await deleteNotebook(deletedNotebookId, user.uid);
            
            // If this was the current notebook, redirect to default notebook
            if (deletedNotebookId === notebookId) {
              const remainingNotebooks = await getNotebooks(user.uid);
              const defaultNotebook = remainingNotebooks.find(nb => nb.isDefault);
              if (defaultNotebook) {
                router.push(`/${defaultNotebook.slug}`);
              } else if (remainingNotebooks.length > 0) {
                router.push(`/${remainingNotebooks[0].slug}`);
              } else {
                router.push('/notebook');
              }
            } else {
              // Just reload the notebooks list
              await loadNotebooks();
            }
            
            setShowDeleteNotebookConfirm(null);
          } catch (error) {
            console.error('Error deleting notebook:', error);
            alert('Failed to delete notebook');
            setShowDeleteNotebookConfirm(null);
          }
        }}
        onCancel={() => setShowDeleteNotebookConfirm(null)}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Create Notebook Dialog */}
      {showCreateNotebookDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-bg-secondary rounded-lg p-6 max-w-md w-full mx-4 border border-bg-primary">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Create New Notebook</h3>
            <input
              type="text"
              value={notebookNameInput}
              onChange={(e) => setNotebookNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && notebookNameInput.trim()) {
                  handleCreateNotebook();
                } else if (e.key === 'Escape') {
                  setShowCreateNotebookDialog(false);
                  setNotebookNameInput('');
                }
              }}
              placeholder="Enter notebook name"
              className="w-full px-4 py-2 bg-bg-primary border border-text-secondary rounded text-text-primary focus:outline-none focus:border-text-primary mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCreateNotebookDialog(false);
                  setNotebookNameInput('');
                }}
                className="px-4 py-2 text-sm bg-bg-primary hover:bg-bg-primary/80 text-text-primary rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNotebook}
                disabled={!notebookNameInput.trim()}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Notebook Dialog */}
      {showRenameDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-bg-secondary rounded-lg p-6 max-w-md w-full mx-4 border border-bg-primary">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Rename Notebook</h3>
            <input
              type="text"
              value={notebookNameInput}
              onChange={(e) => setNotebookNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && notebookNameInput.trim() && notebookNameInput.trim() !== showRenameDialog.currentName) {
                  handleRenameNotebook();
                } else if (e.key === 'Escape') {
                  setShowRenameDialog(null);
                  setNotebookNameInput('');
                }
              }}
              placeholder="Enter notebook name"
              className="w-full px-4 py-2 bg-bg-primary border border-text-secondary rounded text-text-primary focus:outline-none focus:border-text-primary mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowRenameDialog(null);
                  setNotebookNameInput('');
                }}
                className="px-4 py-2 text-sm bg-bg-primary hover:bg-bg-primary/80 text-text-primary rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameNotebook}
                disabled={!notebookNameInput.trim() || notebookNameInput.trim() === showRenameDialog.currentName}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-text-primary">{note.title || 'Untitled'}</h4>
                          <p className="text-xs text-text-secondary mt-1">
                            Deleted: {note.deletedAt?.toLocaleDateString()} {note.deletedAt?.toLocaleTimeString()}
                          </p>
                          {note.contentPlain && (
                            <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                              {note.contentPlain.substring(0, 100)}...
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                const { restoreNote } = await import('@/lib/firebase/firestore');
                                await restoreNote(note.id);
                                // Remove from list
                                setDeletedNotes(deletedNotes.filter(n => n.id !== note.id));
                                setToast({ message: 'Note restored successfully!', type: 'success' });
                                setTimeout(() => setToast(null), 3000);
                              } catch (error) {
                                console.error('Error restoring note:', error);
                                setToast({ message: 'Failed to restore note. Please try again.', type: 'error' });
                                setTimeout(() => setToast(null), 3000);
                              }
                            }}
                            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors whitespace-nowrap"
                            title="Restore note"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => {
                              setShowDeletePermanentConfirm({ noteId: note.id, noteTitle: note.title || 'Untitled' });
                            }}
                            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors whitespace-nowrap"
                            title="Permanently delete"
                          >
                            Delete
                          </button>
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

      {/* Bottom Navigation */}
      {tabs.length > 0 && (
        <BottomNav
          tabs={tabs}
          activeTabId={activeTabId}
          onTabClick={async (tabId: string) => {
            const tab = getTabById(tabId);
            if (!tab) return;
            setActiveTabId(tabId);
            await navigateToTab(tab);
          }}
          onCreateNote={async () => {
            if (!notebookId || !user) return;
            try {
              const uniqueTitle = await generateUniqueNoteTitle('New Note', notebookId, user.uid);
              const noteSlug = createSlug(uniqueTitle);
              
              const newTabId = await createTab({
                notebookId,
                name: uniqueTitle,
                icon: '📄',
                order: 0,
                isLocked: false,
                isStaple: false,
                createdAt: new Date(),
              });

              const newNoteId = await createNote({
                userId: user.uid,
                notebookId,
                tabId: newTabId,
                title: uniqueTitle,
                content: '',
                contentPlain: '',
                images: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                deletedAt: null,
              });

              router.push(`/${notebookSlug}/${noteSlug}`);
            } catch (error) {
              console.error('Error creating note:', error);
            }
          }}
        />
      )}

      {/* Permanent Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!showDeletePermanentConfirm}
        title="Permanently Delete Note"
        message={`Are you sure you want to permanently delete "${showDeletePermanentConfirm?.noteTitle}"? This cannot be undone.`}
        onConfirm={async () => {
          if (!showDeletePermanentConfirm) return;
          try {
            const { permanentlyDeleteNote } = await import('@/lib/firebase/firestore');
            await permanentlyDeleteNote(showDeletePermanentConfirm.noteId);
            // Remove from list
            setDeletedNotes(deletedNotes.filter(n => n.id !== showDeletePermanentConfirm.noteId));
            setToast({ message: 'Note permanently deleted.', type: 'success' });
            setTimeout(() => setToast(null), 3000);
            setShowDeletePermanentConfirm(null);
          } catch (error) {
            console.error('Error permanently deleting note:', error);
            setToast({ message: 'Failed to delete note. Please try again.', type: 'error' });
            setTimeout(() => setToast(null), 3000);
            setShowDeletePermanentConfirm(null);
          }
        }}
        onCancel={() => setShowDeletePermanentConfirm(null)}
        confirmText="Delete Permanently"
        cancelText="Cancel"
      />

      <Toast
        message={toast?.message || ''}
        type={toast?.type || 'info'}
        isVisible={!!toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

