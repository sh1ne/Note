'use client';

import { useState } from 'react';
import { Note } from '@/lib/types';
import { deleteNote } from '@/lib/firebase/firestore';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/common/ConfirmDialog';

interface NoteListProps {
  notes: Note[];
  notebookId: string;
  onNoteClick: (noteId: string) => void;
  onNoteDeleted?: () => void;
}

export default function NoteList({ notes, onNoteClick, onNoteDeleted }: NoteListProps) {
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState<{ noteId: string; noteTitle: string } | null>(null);

  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <p>No notes yet. Create one with the + button.</p>
      </div>
    );
  }

  const formatDateTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Show relative time for recent notes
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      // Always show date and time for all notes
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
    }
  };

  const getPreview = (content: string) => {
    // Strip HTML and get first 100 characters
    const text = content.replace(/<[^>]*>/g, '').trim();
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  };

  const handleDeleteClick = (e: React.MouseEvent, noteId: string, noteTitle: string) => {
    e.stopPropagation(); // Prevent triggering note click
    setDeleteConfirm({ noteId, noteTitle });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteNote(deleteConfirm.noteId);
      setDeleteConfirm(null);
      if (onNoteDeleted) {
        onNoteDeleted();
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      <div className="space-y-2">
        {notes.map((note) => (
          <div
            key={note.id}
            className="relative w-full p-4 bg-bg-secondary rounded hover:bg-bg-secondary/80 transition-colors"
          >
            <button
              onClick={() => onNoteClick(note.id)}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between mb-2 pr-8">
                <h3 className="font-semibold text-lg text-text-primary">
                  {note.title || 'Untitled Note'}
                </h3>
                <span className="text-xs text-text-secondary whitespace-nowrap ml-2">
                  {formatDateTime(note.updatedAt)}
                </span>
              </div>
              {note.contentPlain && (
                <p className="text-sm text-text-secondary line-clamp-2">
                  {getPreview(note.contentPlain)}
                </p>
              )}
              {note.images.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {note.images.slice(0, 3).map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`Image ${idx + 1}`}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ))}
                </div>
              )}
            </button>
            {/* Delete button in top right */}
            <button
              onClick={(e) => handleDeleteClick(e, note.id, note.title || 'Untitled Note')}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-text-secondary hover:text-red-500 transition-colors"
              title="Delete note"
              aria-label="Delete note"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        ))}
      </div>
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete Note"
        message={`Are you sure you want to delete "${deleteConfirm?.noteTitle || 'this note'}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}

