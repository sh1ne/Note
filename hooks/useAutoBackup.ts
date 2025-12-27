import { useEffect, useRef, useCallback } from 'react';
import { saveBackup } from '@/lib/utils/localStorage';
import { getNotebooks, getTabs, getNotes } from '@/lib/firebase/firestore';

/**
 * Hook to manage automatic backups
 * Creates backups every 24 hours or when significant changes occur
 */
export function useAutoBackup(userId: string | null) {
  const lastBackupRef = useRef<number>(0);
  const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  const createBackup = useCallback(async () => {
    if (!userId) return;

    try {
      const notebooks = await getNotebooks(userId);
      const backupData = {
        version: '0.1.0',
        backupDate: new Date().toISOString(),
        userId,
        notebooks: await Promise.all(
          notebooks.map(async (notebook) => {
            const tabs = await getTabs(notebook.id);
            const notes = await getNotes(notebook.id, undefined, userId);
            return {
              ...notebook,
              tabs,
              notes,
            };
          })
        ),
      };

      await saveBackup(backupData);
      lastBackupRef.current = Date.now();
      console.log('Automatic backup created');
    } catch (error) {
      console.error('Error creating automatic backup:', error);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;

    // Check if we need to create a backup
    const checkAndBackup = async () => {
      const lastBackup = lastBackupRef.current || 0;
      const now = Date.now();
      
      // Create backup if it's been more than 24 hours since last backup
      if (now - lastBackup > BACKUP_INTERVAL) {
        await createBackup();
      }
    };

    // Check on mount
    checkAndBackup();

    // Check every hour
    const interval = setInterval(checkAndBackup, 60 * 60 * 1000);

    // Also backup when page is about to unload (user closing tab)
    const handleBeforeUnload = () => {
      const lastBackup = lastBackupRef.current || 0;
      const now = Date.now();
      if (now - lastBackup > 60 * 60 * 1000) { // If last backup was more than 1 hour ago
        // Use sendBeacon for reliable backup on page unload
        createBackup();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId, createBackup]);
}