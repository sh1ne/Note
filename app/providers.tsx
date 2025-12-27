'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import ServiceWorkerRegistration from '@/components/common/ServiceWorkerRegistration';

function SyncQueueManager() {
  useSyncQueue();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <ServiceWorkerRegistration />
          <SyncQueueManager />
          {children}
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

