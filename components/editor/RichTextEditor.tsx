'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useState, useRef } from 'react';
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
  onCreateNote?: () => void;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  onEditorReady,
  onCreateNote,
}: RichTextEditorProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  
  // Track if we're updating from props to prevent onUpdate trigger
  const isUpdatingFromPropsRef = useRef(false);
  
  const editor = useEditor({
    immediatelyRender: false, // Fix SSR hydration warnings
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
        types: ['heading', 'paragraph', 'taskItem'],
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
      // Skip onChange if we're updating from props to prevent infinite loop
      if (isUpdatingFromPropsRef.current) {
        return;
      }
      // Use requestAnimationFrame to ensure we get the latest content
      requestAnimationFrame(() => {
        const html = editor.getHTML();
        const plainText = editor.getText();
        onChange(html, plainText);
      });
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px] text-text-primary',
      },
      handleClick: (view: any, pos: number, event: MouseEvent) => {
        // Allow clicking anywhere to place cursor
        const { state } = view;
        const { doc } = state;
        const { selection } = state;
        
        // If clicking beyond document, place cursor at end
        if (pos > doc.content.size) {
          const endPos = doc.content.size;
          view.dispatch(
            state.tr.setSelection(selection.constructor.create(doc, endPos))
          );
          view.focus();
          return true;
        }
        
        // Use default behavior for clicks within document
        return false;
      },
      handleDOMEvents: {
        click: (view: any, event: MouseEvent) => {
          // Ensure editor gets focus on any click
          if (!view.hasFocus()) {
            view.focus();
          }
          return false; // Allow default behavior
        },
      },
    },
  });

  // Expose editor to parent component
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Track if editor has been initialized and the last content we set from props
  const isInitializedRef = useRef(false);
  const lastPropContentRef = useRef<string>('');

  // Handle content prop changes ONLY on initial load or when explicitly different
  // This prevents the loop: we only update editor from props when switching notes, not on every user input
  useEffect(() => {
    if (!editor) return;
    
    const currentContent = editor.getHTML();
    
    // Only update if:
    // 1. Not yet initialized (first load)
    // 2. Content prop changed AND it's different from what we last set (switching notes)
    // 3. Content prop is different from current editor content
    const shouldUpdate = !isInitializedRef.current || 
                         (content !== lastPropContentRef.current && content !== currentContent);
    
    if (shouldUpdate) {
      lastPropContentRef.current = content;
      isInitializedRef.current = true;
      isUpdatingFromPropsRef.current = true;
      editor.commands.setContent(content, false);
      // Reset flag after editor has processed the update
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isUpdatingFromPropsRef.current = false;
        });
      });
    }
  }, [editor, content]);

  // Show toolbar only when text is selected (mobile) or when editor is focused (desktop)
  useEffect(() => {
    if (!editor) return;

    const checkSelection = () => {
      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      
      if (isMobile) {
        // On mobile: only show when text is selected AND editor is focused
        setShowToolbar(hasSelection && editor.isFocused);
      } else {
        // On desktop: show when focused
        setShowToolbar(editor.isFocused || hasSelection);
      }
    };

    const handleFocus = () => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (!isMobile) {
        setShowToolbar(true);
      }
    };

    const handleBlur = (event: any) => {
      // Don't hide toolbar if clicking on toolbar buttons
      const target = event.event?.target;
      if (target && target.closest('.editor-toolbar')) {
        return;
      }
      
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile) {
        // On mobile: hide when blur (keyboard will cover it anyway)
        setTimeout(() => {
          if (!editor.isFocused) {
            setShowToolbar(false);
          }
        }, 200);
      } else {
        // On desktop: hide when blur
        setTimeout(() => {
          if (!editor.isFocused) {
            setShowToolbar(false);
          }
        }, 200);
      }
    };

    // Check selection on update
    editor.on('selectionUpdate', checkSelection);
    editor.on('focus', handleFocus);
    editor.on('blur', handleBlur);
    
    // Initial check
    checkSelection();

    return () => {
      editor.off('selectionUpdate', checkSelection);
      editor.off('focus', handleFocus);
      editor.off('blur', handleBlur);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }


  return (
    <div className="bg-bg-primary text-text-primary min-h-[calc(100vh-200px)]">
      {showToolbar && <EditorToolbar editor={editor} onCreateNote={onCreateNote} />}
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
      <style jsx global>{`
        .tiptap {
          color: var(--text-primary);
          cursor: text;
        }
        /* Make editor clickable in blank areas */
        .tiptap p {
          min-height: 1.5em;
        }
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
          width: 100%;
        }
        /* Ensure task list items respect text alignment */
        .tiptap ul[data-type="taskList"] li[style*="text-align: left"] > div,
        .tiptap ul[data-type="taskList"] li:not([style*="text-align"]) > div {
          text-align: left;
        }
        .tiptap ul[data-type="taskList"] li[style*="text-align: center"] > div {
          text-align: center;
        }
        .tiptap ul[data-type="taskList"] li[style*="text-align: right"] > div {
          text-align: right;
        }
        .tiptap ul[data-type="taskList"] li[style*="text-align: justify"] > div {
          text-align: justify;
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
        .tiptap p.is-editor-empty:first-child::before {
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}

function EditorToolbar({ editor, onCreateNote }: { editor: any; onCreateNote?: () => void }) {
  if (!editor) {
    return null;
  }

  // Check alignment states
  const isCenterActive = editor.isActive({ textAlign: 'center' });
  const isRightActive = editor.isActive({ textAlign: 'right' });
  const isJustifyActive = editor.isActive({ textAlign: 'justify' });
  
  // Only show left as active if no other alignment is set
  // This prevents default left alignment from incorrectly showing as active
  // TipTap considers left as "active" by default, so we only show it if explicitly needed
  const isLeftActive = !isCenterActive && !isRightActive && !isJustifyActive && 
                       editor.isActive({ textAlign: 'left' }) &&
                       editor.getHTML().includes('style="text-align:left"');

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  return (
    <div className={`editor-toolbar flex items-center justify-between gap-1 p-2 border-b border-bg-secondary bg-bg-secondary/80 backdrop-blur-sm ${isMobile ? 'fixed bottom-0 left-0 right-0 z-50 mb-safe' : 'md:sticky md:top-0 md:bottom-auto md:z-10'} overflow-x-auto`}>
      <div className="flex items-center gap-1 flex-nowrap min-w-0 max-w-full">
      {/* Text Formatting */}
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBold().run();
          // Keep focus on editor
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-2 py-1.5 rounded transition-all text-black dark:text-white hover:text-text-primary shrink-0 ${
          editor.isActive('bold') 
            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400 font-semibold' 
            : 'border-2 border-transparent hover:bg-bg-primary/30'
        }`}
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
        className={`px-2 py-1.5 rounded transition-all text-black dark:text-white hover:text-text-primary shrink-0 ${
          editor.isActive('italic') 
            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400 font-semibold' 
            : 'border-2 border-transparent hover:bg-bg-primary/30'
        }`}
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
        className={`px-2 py-1.5 rounded transition-all text-black dark:text-white hover:text-text-primary shrink-0 ${
          editor.isActive('underline') 
            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400 font-semibold' 
            : 'border-2 border-transparent hover:bg-bg-primary/30'
        }`}
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
        className={`px-2 py-1.5 rounded transition-all text-black dark:text-white hover:text-text-primary shrink-0 ${
          editor.isActive('strike') 
            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400 font-semibold' 
            : 'border-2 border-transparent hover:bg-bg-primary/30'
        }`}
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
        className={`px-2 py-1.5 rounded transition-all text-black dark:text-white hover:text-text-primary shrink-0 ${
          editor.isActive('bulletList') 
            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400 font-semibold' 
            : 'border-2 border-transparent hover:bg-bg-primary/30'
        }`}
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
        className={`px-2 py-1.5 rounded transition-all text-black dark:text-white hover:text-text-primary shrink-0 ${
          editor.isActive('orderedList') 
            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400 font-semibold' 
            : 'border-2 border-transparent hover:bg-bg-primary/30'
        }`}
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
        className={`px-2 py-1.5 rounded transition-all text-black dark:text-white hover:text-text-primary shrink-0 ${
          editor.isActive('taskList') 
            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400 font-semibold' 
            : 'border-2 border-transparent hover:bg-bg-primary/30'
        }`}
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
        className={`px-2 py-1.5 rounded transition-all text-black dark:text-white hover:text-text-primary shrink-0 ${
          isLeftActive 
            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400' 
            : 'border-2 border-transparent hover:bg-bg-primary/30'
        }`}
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
        className={`px-2 py-1.5 rounded transition-all text-black dark:text-white hover:text-text-primary shrink-0 ${
          editor.isActive({ textAlign: 'center' }) 
            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400' 
            : 'border-2 border-transparent hover:bg-bg-primary/30'
        }`}
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
        className={`px-2 py-1.5 rounded transition-all text-black dark:text-white hover:text-text-primary shrink-0 ${
          editor.isActive({ textAlign: 'right' }) 
            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400' 
            : 'border-2 border-transparent hover:bg-bg-primary/30'
        }`}
        title="Align Right"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2h12v1H2V2zm4 3h8v1H6V5zm-4 3h12v1H2V8zm4 3h8v1H6v-1z"/>
        </svg>
      </button>
      </div>
    </div>
  );
}

