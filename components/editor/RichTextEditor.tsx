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
import Placeholder from '@tiptap/extension-placeholder';

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
        // Ensure bulletList and orderedList are enabled
        bulletList: {
          HTMLAttributes: {
            class: 'tiptap-bullet-list',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'tiptap-ordered-list',
          },
        },
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
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
        emptyEditorClass: 'is-editor-empty',
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

  // Show/hide toolbar based on focus - but keep it visible when clicking toolbar buttons
  useEffect(() => {
    if (!editor) return;

    const handleFocus = () => setShowToolbar(true);
    const handleBlur = (event: any) => {
      // Don't hide toolbar if clicking on toolbar buttons
      const target = event.event?.target;
      if (target && target.closest('.editor-toolbar')) {
        return;
      }
      // Small delay to allow button clicks to register
      setTimeout(() => {
        if (!editor.isFocused) {
          setShowToolbar(false);
        }
      }, 200);
    };

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
        /* Bullet and ordered list styling */
        .tiptap ul:not([data-type="taskList"]) {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .tiptap ul:not([data-type="taskList"]) li {
          margin: 0.25rem 0;
        }
        .tiptap ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .tiptap ol li {
          margin: 0.25rem 0;
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
    <div className="editor-toolbar flex flex-wrap gap-2 p-2 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm fixed bottom-16 left-0 right-0 z-10 md:sticky md:top-0 md:bottom-auto">
      {/* Text Formatting */}
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBold().run();
          // Keep focus on editor
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('bold') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleItalic().run();
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('italic') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleUnderline().run();
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('underline') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Underline"
      >
        <u>U</u>
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleStrike().run();
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('strike') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Strikethrough"
      >
        <s>S</s>
      </button>

      {/* Lists */}
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBulletList().run();
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Bullet List"
      >
        •
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleOrderedList().run();
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('orderedList') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Numbered List"
      >
        1.
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleTaskList().run();
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive('taskList') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Task List"
      >
        ☑
      </button>

      {/* Alignment */}
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().setTextAlign('left').run();
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Align Left"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2h12v1H2V2zm0 3h8v1H2V5zm0 3h12v1H2V8zm0 3h8v1H2v-1z"/>
        </svg>
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().setTextAlign('center').run();
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Align Center"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2h12v1H2V2zm2 3h8v1H4V5zm-2 3h12v1H2V8zm2 3h8v1H4v-1z"/>
        </svg>
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().setTextAlign('right').run();
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-3 py-1 rounded transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        title="Align Right"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2h12v1H2V2zm4 3h8v1H6V5zm-4 3h12v1H2V8zm4 3h8v1H6v-1z"/>
        </svg>
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

