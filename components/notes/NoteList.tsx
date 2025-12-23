'use client';

import { Note } from '@/lib/types';
import { deleteNote } from '@/lib/firebase/firestore';
import { useRouter } from 'next/navigation';

interface NoteListProps {
  notes: Note[];
  notebookId: string;
  onNoteClick: (noteId: string) => void;
  onNoteDeleted?: () => void;
}

export default function NoteList({ notes, onNoteClick, onNoteDeleted }: NoteListProps) {
  const router = useRouter();

  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No notes yet. Create one with the + button.</p>
      </div>
    );
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const getPreview = (content: string) => {
    // Strip HTML and get first 100 characters
    const text = content.replace(/<[^>]*>/g, '').trim();
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  };

  const handleDelete = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation(); // Prevent triggering note click
    if (confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteNote(noteId);
        if (onNoteDeleted) {
          onNoteDeleted();
        }
      } catch (error) {
        console.error('Error deleting note:', error);
        alert('Failed to delete note');
      }
    }
  };

  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <div
          key={note.id}
          className="relative w-full p-4 bg-gray-900 rounded hover:bg-gray-800 transition-colors"
        >
          <button
            onClick={() => onNoteClick(note.id)}
            className="w-full text-left"
          >
            <div className="flex items-start justify-between mb-2 pr-8">
              <h3 className="font-semibold text-lg">
                {note.title || 'Untitled Note'}
              </h3>
              <span className="text-xs text-gray-400">
                {formatDate(note.updatedAt)}
              </span>
            </div>
            {note.contentPlain && (
              <p className="text-sm text-gray-400 line-clamp-2">
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
            onClick={(e) => handleDelete(e, note.id)}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
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
  );
}

