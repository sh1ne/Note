'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useSyncQueue } from '@/hooks/useSyncQueue';

function SyncQueueManager() {
  useSyncQueue();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <SyncQueueManager />
          {children}
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

