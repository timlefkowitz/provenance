'use client';

import { useState, useCallback, useRef, useEffect, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { Paperclip, Send, Loader2, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { useAiConsent } from '~/components/ai-consent/ai-consent-provider';
import { TacoAttachmentTray, TacoDropOverlay } from '~/components/taco/taco-attachment-tray';
import { TacoProposalCard } from '~/components/taco/taco-proposal-card';
import {
  TACO_FILE_ACCEPT,
  useTacoAttachments,
  type PendingAttachment,
} from '~/components/taco/use-taco-attachments';
import type { TacoAttachmentRef } from '~/lib/taco/attachments';
import type { TacoProposalView } from '~/lib/taco/proposals';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type NavigationSuggestion = {
  label: string;
  href: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: PendingAttachment[];
  suggestions?: NavigationSuggestion[];
  proposals?: TacoProposalView[];
  /** Notes for Taco's history (e.g. "[Applied: …]"); not rendered. */
  hidden?: boolean;
};

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const QUICK_PROMPTS = [
  'Is this work already on Provenance?',
  'Add provenance from a document',
  'Import a checklist or price list',
  'What artworks are in my collection?',
  'Find grants for my practice',
  'Help me write an artist statement',
];

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function MessageBubble({
  message,
  onProposalResolved,
}: {
  message: ChatMessage;
  onProposalResolved: (note: string) => void;
}) {
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
              att.kind === 'image' && att.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL
                <img
                  key={i}
                  src={att.previewUrl}
                  alt={att.name}
                  className="h-20 w-20 rounded-xl object-cover border border-wine/15 shadow-xs"
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

        {/* Confirm cards */}
        {!isUser &&
          message.proposals?.map((p) => (
            <TacoProposalCard
              key={p.id}
              proposal={p}
              onResolved={(note) => onProposalResolved(note)}
              onNavigate={(href) => router.push(href)}
            />
          ))}

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
        "*stretches and blinks* Hi. I'm Taco — your studio assistant on Provenance. I can look up your collection, find grants and open calls, help with writing, and answer questions about your practice. Drop a photo of a work or a document (COA, invoice, checklist) and I'll check whether it's already on Provenance and suggest updates for you to approve.",
    },
  ]);
  const [input, setInput] = useState('');
  const { ensureAiConsent } = useAiConsent();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentRefs = useRef<TacoAttachmentRef[]>([]);
  const files = useTacoAttachments({ beforeAdd: ensureAiConsent });

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

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        void files.addFiles(e.target.files);
        e.target.value = '';
      }
    },
    [files],
  );

  const addNote = useCallback((note: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: note, hidden: true }]);
  }, []);

  /* ----- Send message ----- */
  const sendMessage = useCallback(
    async (text: string, withFiles = true) => {
      if (loading) return;
      const ready = withFiles ? files.take() : [];
      if (!text.trim() && ready.length === 0) return;
      if (!(await ensureAiConsent())) return;

      console.log('[Taco] sendMessage', text.trim().slice(0, 80), 'files=', ready.length);

      const userMessage: ChatMessage = {
        role: 'user',
        content: text.trim(),
        attachments: ready.length ? ready : undefined,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setLoading(true);

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }));
        const refs = ready.flatMap((r) => (r.ref ? [r.ref] : []));

        const res = await fetch('/api/taco/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            history,
            pathname: '/taco',
            attachmentIds: refs.map((r) => r.id),
            priorAttachments: sentRefs.current.map(({ id, kind, name }) => ({ id, kind, name })),
          }),
        });
        sentRefs.current = [...sentRefs.current, ...refs].slice(-20);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? res.statusText ?? 'Request failed');
        }

        const data = (await res.json()) as {
          reply: string;
          suggestions?: NavigationSuggestion[];
          proposals?: TacoProposalView[];
        };

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply ?? 'No response.',
            suggestions: data.suggestions?.length ? data.suggestions : undefined,
            proposals: data.proposals?.length ? data.proposals : undefined,
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
    [loading, messages, files, ensureAiConsent],
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
      className={`relative flex flex-col flex-1 h-full transition-colors duration-200 ${files.isDragging ? 'bg-wine/5' : ''}`}
      {...files.dropHandlers}
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
              artworks, grants, writing & more
            </p>
          </div>
        </div>
      </div>

      {files.isDragging && <TacoDropOverlay />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {messages.map((m, i) =>
            m.hidden ? null : <MessageBubble key={i} message={m} onProposalResolved={addNote} />,
          )}

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
                onClick={() => {
                  // File prompts need a file: open the picker and prefill the ask.
                  if (prompt.startsWith('Is this') || prompt.startsWith('Add provenance') || prompt.startsWith('Import')) {
                    setInput(prompt);
                    fileInputRef.current?.click();
                    return;
                  }
                  void sendMessage(prompt, false);
                }}
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
          <TacoAttachmentTray items={files.items} onRemove={files.remove} />

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
              accept={TACO_FILE_ACCEPT}
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={files.onPaste}
              placeholder="Ask anything, or drop artwork photos and documents…"
              disabled={loading}
              rows={1}
              className="flex-1 resize-none border border-wine/20 rounded-xl px-4 py-2.5 text-[15px] font-serif bg-white text-ink placeholder:text-ink/35 disabled:opacity-50 focus:outline-none focus:border-wine/50 transition-colors leading-relaxed"
            />

            {/* Send button */}
            <Button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={loading || files.isUploading || (!input.trim() && files.readyCount === 0)}
              className="shrink-0 mb-0.5 bg-wine text-parchment hover:bg-wine/90 font-serif rounded-xl h-10 px-4 disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          <p className="text-[10px] text-ink/30 font-serif text-center">
            Drop artwork photos, COAs, invoices or checklists · Taco asks before saving anything
          </p>
        </div>
      </div>
    </div>
  );
}
