'use client';

import { Note } from '@/lib/types';

interface NoteListProps {
  notes: Note[];
  notebookId: string;
  onNoteClick: (noteId: string) => void;
}

export default function NoteList({ notes, onNoteClick }: NoteListProps) {
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

  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <button
          key={note.id}
          onClick={() => onNoteClick(note.id)}
          className="w-full text-left p-4 bg-gray-900 rounded hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
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
      ))}
    </div>
  );
}

