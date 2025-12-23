'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { logOut } from '@/lib/firebase/auth';
import { useTheme } from '@/contexts/ThemeContext';

export default function MorePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const notebookId = params.notebookId as string;

  const handleLogout = async () => {
    try {
      await logOut();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-16">
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">More</h1>
          {user && (
            <span className="text-sm text-gray-400">{user.email}</span>
          )}
        </div>
        
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Theme</h2>
            <div className="grid grid-cols-2 gap-2">
              {(['dark', 'light', 'purple', 'blue'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`p-3 rounded border ${
                    theme === t
                      ? 'border-white bg-gray-800'
                      : 'border-gray-700 bg-gray-900'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Account</h2>
            <p className="text-gray-400 mb-4">{user?.email || 'Not logged in'}</p>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Features</h2>
            <p className="text-gray-400 text-sm">
              More features coming soon: Storage Usage, Sync Status, Export,
              Notebook Management, and more!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

