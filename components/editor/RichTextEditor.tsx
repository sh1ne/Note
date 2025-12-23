'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useState } from 'react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string, plainText: string) => void;
  placeholder?: string;
  onEditorReady?: (editor: any) => void;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  onEditorReady,
}: RichTextEditorProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Exclude codeBlock from StarterKit since we're not using it
        codeBlock: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Underline,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const plainText = editor.getText();
      onChange(html, plainText);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px] text-white',
      },
    },
  });

  // Expose editor to parent component
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Show/hide toolbar based on focus
  useEffect(() => {
    if (!editor) return;

    const handleFocus = () => setShowToolbar(true);
    const handleBlur = () => setShowToolbar(false);

    editor.on('focus', handleFocus);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('focus', handleFocus);
      editor.off('blur', handleBlur);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="bg-black text-white min-h-[calc(100vh-200px)]">
      {showToolbar && <EditorToolbar editor={editor} />}
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
      <style jsx global>{`
        .tiptap ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .tiptap ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          margin: 0.25rem 0;
        }
        .tiptap ul[data-type="taskList"] li > label {
          flex: 0 0 auto;
          margin-right: 0.5rem;
          margin-top: 0.125rem;
          user-select: none;
          cursor: pointer;
        }
        .tiptap ul[data-type="taskList"] li > div {
          flex: 1 1 auto;
        }
        .tiptap ul[data-type="taskList"] input[type="checkbox"] {
          cursor: pointer;
          margin: 0;
        }
        .tiptap ul[data-type="taskList"] p {
          margin: 0;
          display: inline;
        }
      `}</style>
    </div>
  );
}

function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 p-2 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
      {/* Text Formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('bold') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('italic') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('underline') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Underline"
      >
        <u>U</u>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('strike') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Strikethrough"
      >
        <s>S</s>
      </button>

      {/* Lists */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Bullet List"
      >
        •
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('orderedList') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Numbered List"
      >
        1.
      </button>
      <button
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('taskList') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Task List"
      >
        ☑
      </button>

      {/* Alignment */}
      <button
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Align Left"
      >
        ⬅
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Align Center"
      >
        ⬌
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Align Right"
      >
        ➡
      </button>

      {/* Undo/Redo */}
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className="px-3 py-1 rounded transition-colors disabled:opacity-50 text-gray-300 hover:bg-gray-800"
        title="Undo"
      >
        ↶
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className="px-3 py-1 rounded transition-colors disabled:opacity-50 text-gray-300 hover:bg-gray-800"
        title="Redo"
      >
        ↷
      </button>
    </div>
  );
}

