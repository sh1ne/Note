'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { updateNote, deleteNote } from '@/lib/firebase/firestore';
import { Note } from '@/lib/types';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { saveNoteLocally, addToSyncQueue } from '@/lib/utils/localStorage';
import { Timestamp } from 'firebase/firestore';

let saveTimeout: NodeJS.Timeout | null = null;

export default function NoteEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const notebookId = params.notebookId as string;
  const noteId = params.noteId as string;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [plainText, setPlainText] = useState('');

  useEffect(() => {
    if (user && noteId) {
      loadNote();
    }
  }, [user, noteId]);

  const loadNote = async () => {
    try {
      const noteRef = doc(db, 'notes', noteId);
      const noteSnap = await getDoc(noteRef);
      if (noteSnap.exists()) {
        const noteData = {
          id: noteSnap.id,
          ...noteSnap.data(),
          createdAt: noteSnap.data().createdAt.toDate(),
          updatedAt: noteSnap.data().updatedAt.toDate(),
          deletedAt: noteSnap.data().deletedAt?.toDate() || null,
        } as Note;
        setNote(noteData);
        setContent(noteData.content);
        setPlainText(noteData.contentPlain);
      }
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = useCallback(
    (newContent: string, newPlainText: string) => {
      setContent(newContent);
      setPlainText(newPlainText);

      if (!note || !user) return;

      // Auto-generate title from first line
      const firstLine = newPlainText.split('\n')[0].trim();
      const title = firstLine.length > 0 ? firstLine.substring(0, 50) : '';

      // Save locally immediately
      const updatedNote: Note = {
        ...note,
        content: newContent,
        contentPlain: newPlainText,
        title,
        updatedAt: new Date(),
      };
      saveNoteLocally(updatedNote);

      // Debounce cloud sync (2-3 seconds)
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      saveTimeout = setTimeout(async () => {
        try {
          await updateNote(noteId, {
            content: newContent,
            contentPlain: newPlainText,
            title,
          });
        } catch (error) {
          // If offline or error, add to sync queue
          console.error('Error syncing note:', error);
          addToSyncQueue(noteId, {
            content: newContent,
            contentPlain: newPlainText,
            title,
          });
        }
      }, 2500);
    },
    [note, user, noteId]
  );

  const handleBack = () => {
    router.back();
  };

  const handleUndo = () => {
    // Handled by editor
  };

  const handleRedo = () => {
    // Handled by editor
  };

  const handleDelete = async () => {
    if (!note) return;
    if (confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteNote(noteId);
        router.back();
      } catch (error) {
        console.error('Error deleting note:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>Loading...</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>Note not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="text-white hover:text-gray-400"
            aria-label="Back"
          >
            ←
          </button>
          <button
            onClick={handleUndo}
            className="text-white hover:text-gray-400"
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            onClick={handleRedo}
            className="text-white hover:text-gray-400"
            aria-label="Redo"
          >
            ↷
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              // Share functionality
              alert('Share feature coming soon');
            }}
            className="text-white hover:text-gray-400"
            aria-label="Share"
          >
            ↗
          </button>
          <button
            onClick={() => {
              // Find functionality
              alert('Find feature coming soon');
            }}
            className="text-white hover:text-gray-400"
            aria-label="Find"
          >
            🔍
          </button>
          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-600"
            aria-label="Delete"
          >
            🗑
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="max-w-4xl mx-auto">
        <RichTextEditor
          content={content}
          onChange={handleContentChange}
          placeholder="Start typing..."
        />
      </div>
    </div>
  );
}

