'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Textarea } from '@kit/ui/textarea';
import { Label } from '@kit/ui/label';

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
};

export function MarkdownEditor({ value, onChange, label, placeholder = 'Enter markdown...' }: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(true);

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
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[400px] font-mono text-sm border-2 border-wine/30 bg-parchment text-wine"
          />
          <p className="text-xs text-wine/60 mt-2">
            Supports markdown formatting: **bold**, *italic*, lists, etc.
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

