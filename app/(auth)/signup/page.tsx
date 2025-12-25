'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signUp } from '@/lib/firebase/auth';
import { createNotebook, createTab, createNote } from '@/lib/firebase/firestore';
import Link from 'next/link';

const DEFAULT_TABS = [
  { name: 'Scratch', icon: '✏️', order: 1, isStaple: true },
  { name: 'Now', icon: '⏰', order: 2, isStaple: true },
  { name: 'Short-Term', icon: '📅', order: 3, isStaple: true },
  { name: 'Long-term', icon: '📆', order: 4, isStaple: true },
  { name: 'All Notes', icon: '📋', order: 5, isStaple: true },
  { name: 'More', icon: '⋯', order: 6, isStaple: true },
];

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signUp(email, password);
      const userId = userCredential.user.uid;

      // Create default notebook
      const notebookId = await createNotebook({
        userId,
        name: 'My Notebook',
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: true,
      });

      // Create the 4 staple notes (Scratch, Now, Short-Term, Long-term)
      const stapleNotes = [
        { name: 'Scratch', icon: '✏️', order: 1 },
        { name: 'Now', icon: '⏰', order: 2 },
        { name: 'Short-Term', icon: '📅', order: 3 },
        { name: 'Long-term', icon: '📆', order: 4 },
      ];

      for (const staple of stapleNotes) {
        // Create the note
        await createNote({
          userId,
          notebookId,
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

        // Create tab entry for navigation
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

      // Get notebook to get its slug for redirect
      const { getNotebooks } = await import('@/lib/firebase/firestore');
      const notebooks = await getNotebooks(userId);
      const newNotebook = notebooks.find(nb => nb.id === notebookId);
      if (newNotebook) {
        router.push(`/${newNotebook.slug}`);
      } else {
        // Fallback
        router.push(`/notebook/${notebookId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-8 text-center">Note App</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white"
            />
          </div>
          <div>
            <label htmlFor="password" className="block mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-white text-black rounded font-semibold disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-white underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

