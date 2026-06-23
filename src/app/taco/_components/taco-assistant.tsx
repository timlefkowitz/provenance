'use client';

import { useState, useCallback, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Paperclip, Send, Loader2, X, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@kit/ui/button';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type AttachmentImage = {
  kind: 'image';
  name: string;
  dataUrl: string;
  previewUrl: string;
};

export type AttachmentDoc = {
  kind: 'doc';
  name: string;
  mime: string;
  base64: string;
};

export type Attachment = AttachmentImage | AttachmentDoc;

export type NavigationSuggestion = {
  label: string;
  href: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  suggestions?: NavigationSuggestion[];
};

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const QUICK_PROMPTS = [
  'What artworks are in my collection?',
  'Find grants for my practice',
  'Show me upcoming open calls',
  'Help me write an artist statement',
  'What exhibitions have I listed?',
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/csv',
];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processFile(file: File): Promise<Attachment | null> {
  if (file.size > MAX_FILE_BYTES) return null;

  if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
    const dataUrl = await fileToDataUrl(file);
    return { kind: 'image', name: file.name, dataUrl, previewUrl: dataUrl };
  }

  if (ALLOWED_DOC_TYPES.includes(file.type)) {
    const base64 = await fileToBase64(file);
    return { kind: 'doc', name: file.name, mime: file.type, base64 };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  return (
    <div className="group relative inline-flex items-center gap-1.5 rounded-lg border border-wine/20 bg-white/70 px-2.5 py-1.5 text-xs font-serif text-ink/70 shadow-xs">
      {attachment.kind === 'image' ? (
        <Image
          src={attachment.previewUrl}
          alt={attachment.name}
          width={20}
          height={20}
          className="h-5 w-5 rounded object-cover"
        />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-wine/60" />
      )}
      <span className="max-w-[120px] truncate">{attachment.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 text-ink/40 hover:bg-wine/10 hover:text-wine transition-colors"
        aria-label={`Remove ${attachment.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const router = useRouter();
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="relative shrink-0 mt-0.5">
          <Image
            src="/taco-cat.png"
            alt="Taco"
            width={28}
            height={28}
            className="rounded-full object-cover ring-1 ring-wine/15"
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-parchment" />
        </div>
      )}

      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Attachment previews for user messages */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end">
            {message.attachments.map((att, i) =>
              att.kind === 'image' ? (
                <Image
                  key={i}
                  src={att.previewUrl}
                  alt={att.name}
                  width={80}
                  height={80}
                  className="rounded-xl object-cover border border-wine/15 shadow-xs"
                />
              ) : (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-xl bg-wine/10 px-3 py-2 text-xs font-serif text-wine"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {att.name}
                </div>
              ),
            )}
          </div>
        )}

        {/* Text bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-wine text-parchment rounded-tr-sm'
              : 'bg-white border border-wine/10 text-ink rounded-tl-sm shadow-xs'
          }`}
        >
          {isUser ? (
            <p className="font-serif text-[15px] leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none font-serif text-[15px] leading-relaxed prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-wine prose-a:text-wine prose-headings:font-display prose-headings:text-wine">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Navigation suggestions */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.suggestions.map((s, i) => (
              <Button
                key={i}
                size="sm"
                onClick={() => router.push(s.href)}
                className="bg-wine/10 text-wine hover:bg-wine hover:text-parchment border border-wine/25 font-serif gap-1.5 text-xs h-8 rounded-xl transition-all"
                variant="ghost"
              >
                {s.label}
                <ExternalLink className="h-3 w-3" />
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                            */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TacoAssistant({ userId: _userId }: { userId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "*stretches and blinks* Hi. I'm Taco — your studio assistant on Provenance. I can look up your collection, find grants and open calls, help with writing, and answer questions about your practice. Drop an image or document and I'll read it too.",
    },
  ]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* Auto-grow textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  /* ----- File handling ----- */
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const processed = await Promise.all(arr.map(processFile));
    const valid = processed.filter((a): a is Attachment => a !== null);
    setAttachments((prev) => [...prev, ...valid].slice(0, 8)); // max 8 attachments
  }, []);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        addFiles(e.target.files);
        e.target.value = '';
      }
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ----- Send message ----- */
  const sendMessage = useCallback(
    async (text: string, pendingAttachments: Attachment[] = attachments) => {
      if ((!text.trim() && pendingAttachments.length === 0) || loading) return;

      console.log('[Taco] sendMessage', text.trim().slice(0, 80));

      const userMessage: ChatMessage = {
        role: 'user',
        content: text.trim(),
        attachments: pendingAttachments.length ? [...pendingAttachments] : undefined,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setAttachments([]);
      setLoading(true);

      try {
        const images = pendingAttachments
          .filter((a): a is AttachmentImage => a.kind === 'image')
          .map((a) => ({ dataUrl: a.dataUrl, name: a.name }));

        const docs = pendingAttachments
          .filter((a): a is AttachmentDoc => a.kind === 'doc')
          .map((a) => ({ name: a.name, mime: a.mime, base64: a.base64 }));

        const history = messages.map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch('/api/taco/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            history,
            images: images.length ? images : undefined,
            docs: docs.length ? docs : undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? res.statusText ?? 'Request failed');
        }

        const data = (await res.json()) as {
          reply: string;
          suggestions?: NavigationSuggestion[];
        };

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply ?? 'No response.',
            suggestions: data.suggestions?.length ? data.suggestions : undefined,
          },
        ]);
      } catch (e) {
        console.error('[Taco] sendMessage error', e);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `*tucks ears back* Something went wrong: ${e instanceof Error ? e.message : 'Unknown error'}. Try again?`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, attachments],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  const hasUserSpoken = messages.some((m) => m.role === 'user');

  return (
    <div
      className={`flex flex-col flex-1 h-full transition-colors duration-200 ${isDragging ? 'bg-wine/5' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-wine/15 bg-parchment/95 backdrop-blur-sm px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="relative">
            <Image
              src="/taco-cat.png"
              alt="Taco the cat"
              width={44}
              height={44}
              className="rounded-full object-cover ring-2 ring-wine/15 shadow-sm"
              priority
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-parchment" />
          </div>
          <div>
            <h1 className="font-display text-xl text-wine leading-none mb-0.5">Taco the cat</h1>
            <p className="text-[11px] text-ink/50 font-serif">
              Studio AI · artworks, grants, writing & more
            </p>
          </div>
        </div>
      </div>

      {/* Drop overlay hint */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="rounded-2xl border-2 border-dashed border-wine/40 bg-parchment/90 px-10 py-6 text-center shadow-xl shadow-wine/10">
            <p className="font-display text-lg text-wine">Drop files here</p>
            <p className="font-serif text-sm text-ink/50 mt-1">Images, PDFs, Word docs, text files</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}

          {loading && (
            <div className="flex gap-3">
              <Image
                src="/taco-cat.png"
                alt="Taco"
                width={28}
                height={28}
                className="rounded-full object-cover ring-1 ring-wine/15 shrink-0 mt-0.5"
              />
              <div className="bg-white border border-wine/10 rounded-2xl rounded-tl-sm px-4 py-3 shadow-xs">
                <div className="flex items-center gap-2 text-sm text-ink/50 font-serif">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-wine/60" />
                  Thinking…
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick prompts — only before first user message */}
      {!hasUserSpoken && !loading && (
        <div className="shrink-0 max-w-3xl mx-auto w-full px-4 sm:px-6 pb-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt, [])}
                className="text-xs font-serif border border-wine/25 rounded-full px-3 py-1.5 text-wine/75 hover:bg-wine/8 hover:border-wine/40 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-wine/10 bg-white/60 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 space-y-2">
          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <AttachmentChip
                  key={i}
                  attachment={att}
                  onRemove={() => removeAttachment(i)}
                />
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            {/* Attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="shrink-0 mb-1 p-2 rounded-xl text-ink/40 hover:text-wine hover:bg-wine/8 transition-colors disabled:opacity-40"
              aria-label="Attach file"
              title="Attach image, PDF, or document"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.docx,.doc,.txt,.csv"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything — artworks, grants, writing…"
              disabled={loading}
              rows={1}
              className="flex-1 resize-none border border-wine/20 rounded-xl px-4 py-2.5 text-[15px] font-serif bg-white text-ink placeholder:text-ink/35 disabled:opacity-50 focus:outline-none focus:border-wine/50 transition-colors leading-relaxed"
            />

            {/* Send button */}
            <Button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={loading || (!input.trim() && attachments.length === 0)}
              className="shrink-0 mb-0.5 bg-wine text-parchment hover:bg-wine/90 font-serif rounded-xl h-10 px-4 disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          <p className="text-[10px] text-ink/30 font-serif text-center">
            Drag & drop images or docs · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  );
}
