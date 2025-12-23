'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { logOut } from '@/lib/firebase/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { getNotebooks } from '@/lib/firebase/firestore';
import { Notebook } from '@/lib/types';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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
        {/* Account Section */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Account</h2>
          <p className="text-gray-400 mb-4 text-sm">{user?.email || 'Not logged in'}</p>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Theme Selection */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Theme</h2>
          <div className="grid grid-cols-2 gap-2">
            {(['dark', 'light', 'purple', 'blue'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`p-3 rounded border transition-colors ${
                  theme === t
                    ? 'border-white bg-gray-800 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Notebooks */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Notebooks</h2>
          {notebooks.length === 0 ? (
            <p className="text-gray-400 text-sm">No notebooks yet.</p>
          ) : (
            <div className="space-y-2">
              {notebooks.map((notebook) => (
                <Link
                  key={notebook.id}
                  href={`/dashboard/notebook/${notebook.id}`}
                  className={`block p-3 rounded transition-colors ${
                    notebook.id === notebookId
                      ? 'bg-gray-800 border border-gray-700'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <h3 className="font-semibold">{notebook.name}</h3>
                  <p className="text-xs text-gray-400">
                    {notebook.isDefault ? 'Default' : 'Custom'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Storage Usage */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Storage Usage</h2>
          <p className="text-gray-400 text-sm">Checking storage...</p>
          <p className="text-xs text-gray-500 mt-2">Firebase Storage usage will be displayed here</p>
        </div>

        {/* Sync Status */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Sync Status</h2>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <p className="text-sm text-gray-400">Synced</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">Last sync: Just now</p>
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
            onClick={() => {
              // TODO: Implement trash view
              alert('Trash view coming soon');
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
              <span className="text-sm text-gray-300">Default Notebook</span>
              <span className="text-xs text-gray-500">My Notebook</span>
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

