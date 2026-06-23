'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Minus,
  Undo,
  Redo,
  Check,
  Loader2,
} from 'lucide-react';
import { updateProposal } from '../_actions/update-proposal';
import { cn } from '@kit/ui/utils';

type ProposalEditorProps = {
  proposalId: string;
  initialContent?: object | null;
  initialTitle?: string;
  onTitleChange?: (title: string) => void;
};

export function ProposalEditor({
  proposalId,
  initialContent,
  initialTitle = 'Untitled Proposal',
  onTitleChange,
}: ProposalEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);

  const save = useCallback(
    async (json: object, text: string, latestTitle: string) => {
      setSaveState('saving');
      const { success } = await updateProposal({
        id: proposalId,
        title: latestTitle,
        contentJson: json,
        contentText: text,
      });
      setSaveState(success ? 'saved' : 'unsaved');
    },
    [proposalId],
  );

  const scheduleAutosave = useCallback(
    (json: object, text: string, latestTitle: string) => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      setSaveState('unsaved');
      autosaveTimer.current = setTimeout(() => {
        void save(json, text, latestTitle);
      }, 1500);
    },
    [save],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your proposal…',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-wine underline' },
      }),
    ],
    content: (initialContent as Parameters<typeof useEditor>[0]['content']) ?? undefined,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[400px] font-serif text-ink leading-relaxed px-8 py-6',
      },
    },
    onUpdate: ({ editor }) => {
      if (!isMounted.current) return;
      scheduleAutosave(editor.getJSON(), editor.getText(), title);
    },
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  function handleTitleChange(value: string) {
    setTitle(value);
    onTitleChange?.(value);
    if (editor) {
      scheduleAutosave(editor.getJSON(), editor.getText(), value);
    }
  }

  function addLink() {
    const url = window.prompt('Enter URL');
    if (!url || !editor) return;
    editor.chain().focus().setLink({ href: url }).run();
  }

  const toolbarItems = [
    {
      label: 'Bold',
      icon: Bold,
      action: () => editor?.chain().focus().toggleBold().run(),
      isActive: () => editor?.isActive('bold') ?? false,
    },
    {
      label: 'Italic',
      icon: Italic,
      action: () => editor?.chain().focus().toggleItalic().run(),
      isActive: () => editor?.isActive('italic') ?? false,
    },
    null, // separator
    {
      label: 'Heading 2',
      icon: Heading2,
      action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor?.isActive('heading', { level: 2 }) ?? false,
    },
    {
      label: 'Heading 3',
      icon: Heading3,
      action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: () => editor?.isActive('heading', { level: 3 }) ?? false,
    },
    null,
    {
      label: 'Bullet list',
      icon: List,
      action: () => editor?.chain().focus().toggleBulletList().run(),
      isActive: () => editor?.isActive('bulletList') ?? false,
    },
    {
      label: 'Ordered list',
      icon: ListOrdered,
      action: () => editor?.chain().focus().toggleOrderedList().run(),
      isActive: () => editor?.isActive('orderedList') ?? false,
    },
    null,
    {
      label: 'Divider',
      icon: Minus,
      action: () => editor?.chain().focus().setHorizontalRule().run(),
      isActive: () => false,
    },
    {
      label: 'Link',
      icon: LinkIcon,
      action: addLink,
      isActive: () => editor?.isActive('link') ?? false,
    },
    null,
    {
      label: 'Undo',
      icon: Undo,
      action: () => editor?.chain().focus().undo().run(),
      isActive: () => false,
    },
    {
      label: 'Redo',
      icon: Redo,
      action: () => editor?.chain().focus().redo().run(),
      isActive: () => false,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-2 border-b border-wine/10 bg-parchment/80 flex-wrap sticky top-0 z-10">
        {toolbarItems.map((item, idx) => {
          if (!item) {
            return (
              <div key={`sep-${idx}`} className="w-px h-5 bg-wine/15 mx-1.5 shrink-0" />
            );
          }
          const Icon = item.icon;
          const active = item.isActive();
          return (
            <button
              key={item.label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                item.action();
              }}
              title={item.label}
              className={cn(
                'h-8 w-8 flex items-center justify-center rounded-lg transition-all text-sm',
                active
                  ? 'bg-wine text-parchment'
                  : 'text-ink/50 hover:text-wine hover:bg-wine/8',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}

        {/* Save indicator */}
        <div className="ml-auto flex items-center gap-1.5 text-xs font-serif">
          {saveState === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-ink/40" />
              <span className="text-ink/40">Saving…</span>
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-ink/40">Saved</span>
            </>
          )}
          {saveState === 'unsaved' && (
            <span className="text-ink/40">Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="px-8 pt-8 pb-2">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Proposal title"
          className="w-full font-display text-3xl font-bold text-wine bg-transparent border-none outline-none placeholder:text-wine/25 leading-tight"
        />
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto cursor-text"
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
