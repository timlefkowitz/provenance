'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Strikethrough } from 'lucide-react';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';
import { FIELD_TEXTAREA } from '~/components/editorial-form';
import { EditorialMarkdown } from '~/components/editorial-markdown';

type Edit = { value: string; selectionStart: number; selectionEnd: number };

/** Wrap the selection in `marker` (or unwrap it if it is already wrapped). */
function toggleWrap(value: string, start: number, end: number, marker: string, placeholder: string): Edit {
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);

  // `*` next to `**` is bold, not italic — unless it's `***` (both).
  const isBoldEdge = marker === '*' && before.endsWith('**') && !before.endsWith('***');
  if (!isBoldEdge && before.endsWith(marker) && after.startsWith(marker)) {
    return {
      value: before.slice(0, -marker.length) + selected + after.slice(marker.length),
      selectionStart: start - marker.length,
      selectionEnd: end - marker.length,
    };
  }

  const text = selected || placeholder;
  return {
    value: before + marker + text + marker + after,
    selectionStart: start + marker.length,
    selectionEnd: start + marker.length + text.length,
  };
}

/** Toggle a prefix (`- `, `1. `, `> `, `## `) on every line the selection touches. */
function toggleLinePrefix(value: string, start: number, end: number, prefix: string | ((i: number) => string)): Edit {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = value.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const prefixFor = (i: number) => (typeof prefix === 'function' ? prefix(i) : prefix);
  const pattern = typeof prefix === 'function' ? /^\d+\.\s/ : null;
  const hasPrefix = (line: string, i: number) =>
    pattern ? pattern.test(line) : line.startsWith(prefixFor(i));
  const allPrefixed = lines.every((line, i) => hasPrefix(line, i));

  const next = lines.map((line, i) => {
    if (allPrefixed) return pattern ? line.replace(pattern, '') : line.slice(prefixFor(i).length);
    return hasPrefix(line, i) ? line : prefixFor(i) + line;
  });
  const replaced = next.join('\n');
  return {
    value: value.slice(0, lineStart) + replaced + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + replaced.length,
  };
}

function insertLink(value: string, start: number, end: number): Edit {
  const selected = value.slice(start, end) || 'link text';
  const inserted = `[${selected}](https://)`;
  const urlStart = start + selected.length + 3;
  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    selectionStart: urlStart,
    selectionEnd: urlStart + 'https://'.length,
  };
}

type Tool = {
  label: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  apply: (value: string, start: number, end: number) => Edit;
};

const TOOLS: Tool[][] = [
  [
    { label: 'Bold', shortcut: 'B', icon: Bold, apply: (v, s, e) => toggleWrap(v, s, e, '**', 'bold text') },
    { label: 'Italic', shortcut: 'I', icon: Italic, apply: (v, s, e) => toggleWrap(v, s, e, '*', 'italic text') },
    { label: 'Strikethrough', icon: Strikethrough, apply: (v, s, e) => toggleWrap(v, s, e, '~~', 'text') },
  ],
  [
    { label: 'Heading', icon: Heading2, apply: (v, s, e) => toggleLinePrefix(v, s, e, '## ') },
    { label: 'Quote', icon: Quote, apply: (v, s, e) => toggleLinePrefix(v, s, e, '> ') },
  ],
  [
    { label: 'Bulleted list', icon: List, apply: (v, s, e) => toggleLinePrefix(v, s, e, '- ') },
    { label: 'Numbered list', icon: ListOrdered, apply: (v, s, e) => toggleLinePrefix(v, s, e, (i) => `${i + 1}. `) },
  ],
  [{ label: 'Link', shortcut: 'K', icon: Link2, apply: insertLink }],
];

const SHORTCUTS = new Map(
  TOOLS.flat()
    .filter((t) => t.shortcut)
    .map((t) => [t.shortcut!.toLowerCase(), t]),
);

const TAB_CLASS =
  'relative px-1 py-0.5 font-jetbrains text-[10px] font-medium uppercase tracking-[0.18em] transition-colors ' +
  "after:content-[''] after:absolute after:bottom-[-2px] after:left-0 after:h-[1.5px] after:bg-vermillion after:transition-all after:duration-300";

/**
 * Textarea with a markdown formatting toolbar (bold, italic, headings, lists,
 * quotes, links), ⌘B / ⌘I / ⌘K shortcuts, and a Write / Preview toggle.
 * The value stays plain markdown; render it with EditorialMarkdown.
 */
export function MarkdownTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 6,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  // Selection to restore once the edited value has rendered (setting the
  // value programmatically moves the caret to the end).
  const pendingSelection = useRef<Edit | null>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    const pending = pendingSelection.current;
    if (!el || !pending || pending.value !== value) return;
    pendingSelection.current = null;
    el.focus();
    el.setSelectionRange(pending.selectionStart, pending.selectionEnd);
  }, [value]);

  const run = (tool: Tool) => {
    const el = textareaRef.current;
    if (!el) return;
    const edit = tool.apply(value, el.selectionStart, el.selectionEnd);
    pendingSelection.current = edit;
    onChange(edit.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
    const tool = SHORTCUTS.get(e.key.toLowerCase());
    if (!tool) return;
    e.preventDefault();
    run(tool);
  };

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className={cn('border border-editorial-border/25 bg-cream/50 transition-colors focus-within:border-vermillion', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-editorial-border/20 bg-bone/60 px-2 py-1.5">
        <div
          role="toolbar"
          aria-label="Formatting"
          className={cn('flex flex-wrap items-center', mode === 'preview' && 'pointer-events-none opacity-40')}
        >
          {TOOLS.map((group, gi) => (
            <div key={gi} className="flex items-center">
              {gi > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-editorial-border/25" />}
              {group.map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  // Keep the textarea's selection when clicking a tool.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => run(tool)}
                  disabled={mode === 'preview'}
                  title={tool.shortcut ? `${tool.label} (${isMac ? '⌘' : 'Ctrl+'}${tool.shortcut})` : tool.label}
                  aria-label={tool.label}
                  className="flex h-8 w-8 items-center justify-center text-editorial-ink/70 transition-colors hover:bg-vermillion/10 hover:text-vermillion focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion/30"
                >
                  <tool.icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 pr-1">
          {(['write', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                TAB_CLASS,
                mode === m
                  ? 'text-vermillion after:w-full'
                  : 'text-editorial-ink/60 after:w-0 hover:text-vermillion hover:after:w-full',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === 'write' ? (
        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          className={cn(
            FIELD_TEXTAREA,
            'resize-y border-0 bg-transparent hover:border-0 focus-visible:border-0',
          )}
        />
      ) : (
        <div className="min-h-[144px] px-3.5 py-3">
          {value.trim() ? (
            <EditorialMarkdown>{value}</EditorialMarkdown>
          ) : (
            <p className="font-serif text-editorial-ink/35">Nothing to preview yet.</p>
          )}
        </div>
      )}

      <p className="border-t border-editorial-border/15 px-3.5 py-1.5 font-jetbrains text-[9px] uppercase tracking-[0.16em] text-editorial-ink/40">
        Markdown supported · **bold** · *italic* · - list · [link](url)
      </p>
    </div>
  );
}
