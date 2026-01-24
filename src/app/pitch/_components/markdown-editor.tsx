'use client';

import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Textarea } from '@kit/ui/textarea';
import { Label } from '@kit/ui/label';
import { Bold, Italic, Heading2, List, ListOrdered, Link } from 'lucide-react';

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
};

export function MarkdownEditor({ value, onChange, label, placeholder = 'Enter markdown...' }: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertText = (before: string, after: string = '', placeholder: string = 'text') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const textToInsert = selectedText || placeholder;

    const newValue = 
      value.substring(0, start) + 
      before + textToInsert + after + 
      value.substring(end);

    onChange(newValue);

    // Set cursor position after inserted text
    setTimeout(() => {
      const newCursorPos = start + before.length + textToInsert.length + after.length;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertAtLineStart = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lines = value.split('\n');
    let currentLine = 0;
    let charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= start) {
        currentLine = i;
        break;
      }
      charCount += lines[i].length + 1; // +1 for newline
    }

    lines[currentLine] = prefix + lines[currentLine];
    onChange(lines.join('\n'));

    setTimeout(() => {
      const newCursorPos = start + prefix.length;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const toolbarButtons = [
    {
      icon: Bold,
      label: 'Bold',
      onClick: () => insertText('**', '**', 'bold text'),
    },
    {
      icon: Italic,
      label: 'Italic',
      onClick: () => insertText('*', '*', 'italic text'),
    },
    {
      icon: Heading2,
      label: 'Heading',
      onClick: () => insertAtLineStart('## '),
    },
    {
      icon: List,
      label: 'Bullet List',
      onClick: () => insertAtLineStart('- '),
    },
    {
      icon: ListOrdered,
      label: 'Numbered List',
      onClick: () => insertAtLineStart('1. '),
    },
    {
      icon: Link,
      label: 'Link',
      onClick: () => insertText('[', '](url)', 'link text'),
    },
  ];

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <Label className="font-display text-wine">{label}</Label>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-wine/70 hover:text-wine underline"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
      )}
      <div className={showPreview ? 'grid grid-cols-2 gap-4' : ''}>
        <div>
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 p-2 border-2 border-wine/30 border-b-0 bg-wine/5 rounded-t">
            {toolbarButtons.map((button) => {
              const Icon = button.icon;
              return (
                <button
                  key={button.label}
                  type="button"
                  onClick={button.onClick}
                  className="p-2 hover:bg-wine/20 rounded text-wine transition-colors"
                  title={button.label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[400px] font-mono text-sm border-2 border-wine/30 bg-parchment text-wine rounded-t-none"
          />
          <p className="text-xs text-wine/60 mt-2">
            Use toolbar buttons or type markdown: **bold**, *italic*, lists, etc.
          </p>
        </div>
        {showPreview && (
          <div className="border-2 border-wine/30 bg-parchment p-4 rounded overflow-y-auto max-h-[400px]">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="text-wine mb-2">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 text-wine/90">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 text-wine/90">{children}</ol>,
                  li: ({ children }) => <li className="text-wine/90">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-wine">{children}</strong>,
                  em: ({ children }) => <em className="italic text-wine">{children}</em>,
                  h1: ({ children }) => <h1 className="font-display text-2xl text-wine mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="font-display text-xl text-wine mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="font-display text-lg text-wine mb-1">{children}</h3>,
                }}
              >
                {value || 'Preview will appear here...'}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

