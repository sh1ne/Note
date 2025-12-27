'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useState, useRef } from 'react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { ImageResize } from './ImageResize';
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
  userId?: string;
  noteId?: string;
  onShowToolbar?: () => void;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  onEditorReady,
  onCreateNote,
  userId,
  noteId,
  onShowToolbar,
}: RichTextEditorProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  
  // Track if we're updating from props to prevent onUpdate trigger
  const isUpdatingFromPropsRef = useRef(false);
  const onChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>('');
  // Track the last time content was set programmatically - ignore updates for a short period
  const lastProgrammaticUpdateRef = useRef<number>(0);
  const PROGRAMMATIC_UPDATE_IGNORE_WINDOW = 2000; // Ignore updates for 2 seconds after programmatic update
  // Track if onChange should be enabled - disable during initialization
  const onChangeEnabledRef = useRef(false);
  
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
      ImageResize.configure({
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
    // Don't use content prop - we'll set it manually to avoid controlled component issues
    // This makes the editor uncontrolled, preventing infinite loops
    onUpdate: ({ editor }) => {
      // CRITICAL: Skip onChange if we're updating from props to prevent infinite loop
      if (isUpdatingFromPropsRef.current) {
        return;
      }
      
      // CRITICAL: Don't process onChange if it's not enabled (during initialization)
      if (!onChangeEnabledRef.current) {
        return;
      }
      
      // CRITICAL: Ignore updates that happen shortly after a programmatic update
      const now = Date.now();
      if (now - lastProgrammaticUpdateRef.current < PROGRAMMATIC_UPDATE_IGNORE_WINDOW) {
        return;
      }
      
      // Get current content
      const html = editor.getHTML();
      const plainText = editor.getText();
      
      // Only process if content actually changed
      if (html === lastContentRef.current) {
        return;
      }
      
      lastContentRef.current = html;
      
      // Debounce onChange to prevent rapid-fire calls
      // Clear any pending onChange call
      if (onChangeTimeoutRef.current) {
        clearTimeout(onChangeTimeoutRef.current);
        onChangeTimeoutRef.current = null;
      }
      
      // Debounce the onChange call - only call if content actually changed
      onChangeTimeoutRef.current = setTimeout(() => {
        // Triple-check: flag, timing, enabled state, and content
        if (isUpdatingFromPropsRef.current || !onChangeEnabledRef.current) {
          onChangeTimeoutRef.current = null;
          return;
        }
        
        const checkTime = Date.now();
        if (checkTime - lastProgrammaticUpdateRef.current < PROGRAMMATIC_UPDATE_IGNORE_WINDOW) {
          onChangeTimeoutRef.current = null;
          return;
        }
        
        const currentHtml = editor.getHTML();
        if (currentHtml === html && currentHtml !== lastContentRef.current) {
          lastContentRef.current = currentHtml;
      onChange(html, plainText);
        }
        onChangeTimeoutRef.current = null;
      }, 500);
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

  // Track if editor has been initialized - only set content ONCE on mount
  const isInitializedRef = useRef(false);
  const initialContentRef = useRef<string | null>(null);
  const noteIdRef = useRef<string | undefined>(noteId);

  // Update noteId ref when it changes (switching notes)
  useEffect(() => {
    if (noteId !== noteIdRef.current) {
      noteIdRef.current = noteId;
      // Reset initialization when switching notes
      isInitializedRef.current = false;
      initialContentRef.current = null;
    }
  }, [noteId]);

  // Set initial content ONLY once when editor is first created or when noteId changes
  // After this, we NEVER update editor from content prop to prevent infinite loops
  useEffect(() => {
    if (!editor || isInitializedRef.current) return;
    
    // Only set content once when editor is first ready or when noteId changes
    // Check if noteId changed to determine if we should update content
    if (content && (initialContentRef.current === null || noteId !== noteIdRef.current)) {
      initialContentRef.current = content;
      isInitializedRef.current = true;
      isUpdatingFromPropsRef.current = true;
      onChangeEnabledRef.current = false; // Disable onChange during initialization
      lastProgrammaticUpdateRef.current = Date.now();
      
      // Use a transaction to set content without triggering update
      editor.commands.setContent(content, false);
      
      // Reset flag and enable onChange after editor processes the update - use multiple RAFs and a longer delay
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              // Double-check editor content matches what we set
              const currentContent = editor.getHTML();
              if (currentContent === content) {
                isUpdatingFromPropsRef.current = false;
                // Enable onChange only after content is set and stable
                setTimeout(() => {
                  onChangeEnabledRef.current = true;
                }, 500); // Additional delay before enabling onChange
              } else {
                // Content doesn't match, keep flag set longer
                setTimeout(() => {
                  isUpdatingFromPropsRef.current = false;
                  onChangeEnabledRef.current = true;
                }, 500);
              }
            }, 300); // Longer delay to ensure all updates are processed
          });
        });
      });
    }
  }, [editor, noteId]); // ONLY depend on editor and noteId - NOT content to prevent loops

  // Long press handler for mobile
  useEffect(() => {
    if (!editor) return;

    const editorElement = editor.view.dom;
    let longPressTimer: NodeJS.Timeout | null = null;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    if (isMobile) {
      const handleTouchStart = (e: TouchEvent) => {
        longPressTimer = setTimeout(() => {
          setShowToolbar(true);
          if (onShowToolbar) {
            onShowToolbar();
          }
          // Prevent default context menu
          e.preventDefault();
        }, 500); // 500ms long press
      };
      
      const handleTouchEnd = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };
      
      const handleTouchMove = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };
      
      editorElement.addEventListener('touchstart', handleTouchStart);
      editorElement.addEventListener('touchend', handleTouchEnd);
      editorElement.addEventListener('touchmove', handleTouchMove);
      
      return () => {
        editorElement.removeEventListener('touchstart', handleTouchStart);
        editorElement.removeEventListener('touchend', handleTouchEnd);
        editorElement.removeEventListener('touchmove', handleTouchMove);
        if (longPressTimer) {
          clearTimeout(longPressTimer);
        }
      };
    }
  }, [editor, onShowToolbar]);

  // Show toolbar only when text is selected (mobile) or when editor is focused (desktop)
  useEffect(() => {
    if (!editor) return;

    const checkSelection = () => {
      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      
      if (isMobile) {
        // On mobile: show when editor is focused (not just when text is selected)
        // This ensures toolbar is visible when typing
        setShowToolbar(editor.isFocused);
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

  // Handle drag and drop for images (desktop only)
  useEffect(() => {
    if (!editor || !userId || !noteId) return;
    
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) return;
    
    const editorWrapper = document.querySelector('.bg-bg-primary') as HTMLElement;
    if (!editorWrapper) return;
    
    const handleDragOver = (e: Event) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
    };
    
    const handleDrop = async (e: Event) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      
      const files = dragEvent.dataTransfer?.files;
      if (!files || files.length === 0) return;
      
      const imageFile = Array.from(files).find(file => file.type.startsWith('image/'));
      if (!imageFile) return;
      
      try {
        const { uploadImage } = await import('@/lib/firebase/storage');
        const imageUrl = await uploadImage(imageFile, userId, noteId);
        editor.chain().focus().setImage({ src: imageUrl }).run();
      } catch (error) {
        console.error('Error uploading image:', error);
      }
    };
    
    editorWrapper.addEventListener('dragover', handleDragOver);
    editorWrapper.addEventListener('drop', handleDrop);
    
    return () => {
      editorWrapper.removeEventListener('dragover', handleDragOver);
      editorWrapper.removeEventListener('drop', handleDrop);
    };
  }, [editor, userId, noteId]);


  if (!editor) {
    return null;
  }


  return (
    <div className="bg-bg-primary text-text-primary min-h-[calc(100vh-200px)]">
      {showToolbar && <EditorToolbar editor={editor} onCreateNote={onCreateNote} userId={userId} noteId={noteId} />}
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
          width: 100%;
          min-width: 0;
        }
        .tiptap ul[data-type="taskList"] input[type="checkbox"] {
          cursor: pointer;
          margin: 0;
        }
        .tiptap ul[data-type="taskList"] p {
          margin: 0;
          display: block;
          width: 100%;
        }
        /* Ensure task list items respect text alignment */
        /* TipTap applies text-align style to the <p> element, ensure it works */
        .tiptap ul[data-type="taskList"] li > div > p[style*="text-align: center"] {
          text-align: center !important;
        }
        .tiptap ul[data-type="taskList"] li > div > p[style*="text-align: right"] {
          text-align: right !important;
        }
        .tiptap ul[data-type="taskList"] li > div > p[style*="text-align: justify"] {
          text-align: justify !important;
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
        /* Image styling - default max-width for images without explicit width */
        .tiptap img {
          max-width: 100%;
          height: auto;
          cursor: pointer;
          display: block;
        }
        /* Images with explicit width (set via ImageResize) will override max-width via inline style */
        @media (max-width: 768px) {
          .tiptap img {
            position: relative;
          }
        }
      `}</style>
    </div>
  );
}

function EditorToolbar({ 
  editor, 
  onCreateNote, 
  userId, 
  noteId 
}: { 
  editor: any; 
  onCreateNote?: () => void;
  userId?: string;
  noteId?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!editor) {
    return null;
  }

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    if (!userId || !noteId) {
      console.error('Cannot upload image: userId or noteId missing');
      return;
    }

    setIsUploading(true);
    try {
      const { uploadImage } = await import('@/lib/firebase/storage');
      const imageUrl = await uploadImage(file, userId, noteId);
      
      // Insert image into editor at current cursor position
      editor.chain().focus().setImage({ src: imageUrl }).run();
    } catch (error) {
      console.error('Error uploading image:', error);
      // Could show a toast here
    } finally {
      setIsUploading(false);
      // Reset file input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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
    <div className={`editor-toolbar flex items-center justify-between gap-1 p-2 border-b border-bg-secondary bg-bg-secondary/80 backdrop-blur-sm ${isMobile ? 'sticky top-0 left-0 right-0 z-40' : 'md:sticky md:top-0 md:bottom-auto md:z-10'} overflow-x-auto`}>
      <div className="flex items-center gap-1 flex-nowrap min-w-0 max-w-full">
      {/* Text Formatting */}
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBold().run();
          // Keep focus on editor
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-2 py-1.5 rounded transition-all text-text-primary hover:text-text-primary shrink-0 ${
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
        className={`px-2 py-1.5 rounded transition-all text-text-primary hover:text-text-primary shrink-0 ${
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
        className={`px-2 py-1.5 rounded transition-all text-text-primary hover:text-text-primary shrink-0 ${
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
        className={`px-2 py-1.5 rounded transition-all text-text-primary hover:text-text-primary shrink-0 ${
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
        className={`px-2 py-1.5 rounded transition-all text-text-primary hover:text-text-primary shrink-0 ${
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
        className={`px-2 py-1.5 rounded transition-all text-text-primary hover:text-text-primary shrink-0 ${
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
        className={`px-2 py-1.5 rounded transition-all text-text-primary hover:text-text-primary shrink-0 ${
          editor.isActive('taskList') 
            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400 font-semibold' 
            : 'border-2 border-transparent hover:bg-bg-primary/30'
        }`}
        title="Task List"
      >
        ☑
      </button>

      {/* Image Upload - Removed from toolbar, now in title bar */}

      {/* Alignment */}
      <button
        onClick={(e) => {
          e.preventDefault();
          editor.chain().focus().setTextAlign('left').run();
          setTimeout(() => editor.commands.focus(), 10);
        }}
        className={`px-2 py-1.5 rounded transition-all text-text-primary hover:text-text-primary shrink-0 ${
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
        className={`px-2 py-1.5 rounded transition-all text-text-primary hover:text-text-primary shrink-0 ${
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
        className={`px-2 py-1.5 rounded transition-all text-text-primary hover:text-text-primary shrink-0 ${
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

