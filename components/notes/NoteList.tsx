'use client';

import { useState } from 'react';
import { Note } from '@/lib/types';
import { deleteNote } from '@/lib/firebase/firestore';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/common/ConfirmDialog';

interface NoteListProps {
  notes: Note[];
  notebookId: string;
  onNoteClick: (note: Note) => void;
  onNoteDeleted?: () => void;
}

export default function NoteList({ notes, onNoteClick, onNoteDeleted }: NoteListProps) {
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState<{ noteId: string; noteTitle: string } | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

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

  const toggleNoteSelection = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedNotes.size === notes.length) {
      setSelectedNotes(new Set());
    } else {
      setSelectedNotes(new Set(notes.map((n) => n.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNotes.size === 0) return;
    setBulkDeleteConfirm(true);
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      const deletePromises = Array.from(selectedNotes).map((noteId) => deleteNote(noteId));
      await Promise.all(deletePromises);
      setSelectedNotes(new Set());
      setBulkDeleteConfirm(false);
      if (onNoteDeleted) {
        onNoteDeleted();
      }
    } catch (error) {
      console.error('Error deleting notes:', error);
      alert('Failed to delete some notes');
      setBulkDeleteConfirm(false);
    }
  };

  const hasSelection = selectedNotes.size > 0;

  return (
    <>
      {/* Select All button - always visible, small */}
      <div className="mb-2 flex items-center justify-end">
        <button
          onClick={toggleSelectAll}
          className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-secondary rounded transition-colors"
          title={selectedNotes.size === notes.length ? 'Deselect All' : 'Select All'}
        >
          {selectedNotes.size === notes.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      {/* Bulk actions bar */}
      {hasSelection && (
        <div className="sticky top-0 bg-bg-secondary border-b border-bg-primary p-3 z-10 flex items-center justify-between mb-2">
          <span className="text-sm text-text-primary">
            {selectedNotes.size} note{selectedNotes.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Delete ({selectedNotes.size})
            </button>
          </div>
        </div>
      )}
      <div className="space-y-1">
        {notes.map((note) => {
          const isSelected = selectedNotes.has(note.id);
          return (
            <div
              key={note.id}
              className={`relative w-full p-2 bg-bg-secondary rounded hover:bg-bg-secondary/80 transition-colors ${
                isSelected ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                {/* Checkbox - larger clickable area */}
                <div 
                  className="mt-1 flex-shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNoteSelection(note.id, e as any);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleNoteSelection(note.id, e as any);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!isSelected) {
                      onNoteClick(note);
                    }
                  }}
                  className="flex-1 text-left"
            >
                  <div className="flex items-start justify-between mb-1 pr-8">
                    <h3 className="font-semibold text-base text-text-primary">
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
                    <div className="mt-1 flex gap-2">
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
              </div>
              {/* Delete button in top right - only show when not in selection mode */}
              {!hasSelection && (
            <button
              onClick={(e) => handleDeleteClick(e, note.id, note.title || 'Untitled Note')}
                  className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-400 transition-colors"
              title="Delete note"
              aria-label="Delete note"
            >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
              )}
          </div>
          );
        })}
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
      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        title="Delete Notes"
        message={`Are you sure you want to delete ${selectedNotes.size} note${selectedNotes.size !== 1 ? 's' : ''}? This action cannot be undone.`}
        onConfirm={handleBulkDeleteConfirm}
        onCancel={() => setBulkDeleteConfirm(false)}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}

