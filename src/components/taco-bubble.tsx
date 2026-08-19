'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, Send, X, Maximize2 } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type BubbleMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: { label: string; href: string }[];
};

/* -------------------------------------------------------------------------- */
/*  Routes where the bubble should be hidden                                  */
/* -------------------------------------------------------------------------- */

const HIDDEN_PREFIXES = ['/taco', '/onboarding', '/_sites', '/profile/site/preview'];

function useIsHidden(): boolean {
  const pathname = usePathname();
  return HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/* -------------------------------------------------------------------------- */
/*  Greeting pool                                                             */
/* -------------------------------------------------------------------------- */

const GREETINGS = [
  "*stretches* Hi. I'm Taco — your studio assistant. Ask me anything.",
  "*blinks slowly* Hello. I'm here whenever you need me.",
  "*tail flick* Taco at your service. What do you need?",
  "*peers over your shoulder* Oh, you noticed me. Good. I'm Taco.",
];

let msgId = 1;

/* -------------------------------------------------------------------------- */
/*  Body scroll lock                                                          */
/* -------------------------------------------------------------------------- */

function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [locked]);
}

/* -------------------------------------------------------------------------- */
/*  Cat badge — cycles through cat sounds on the avatar button               */
/* -------------------------------------------------------------------------- */

const CAT_SOUNDS = ['prrr', 'meow', 'mrrp', '*purr*', 'nya~', 'mrow'];

function CatBadge() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % CAT_SOUNDS.length);
    }, 4_000);
    return () => clearInterval(t);
  }, []);

  return (
    <span className="absolute -right-1 -top-1 flex min-w-[1.75rem] items-center justify-center rounded-full bg-wine px-1 py-0.5 text-[8px] font-bold italic text-parchment shadow leading-none whitespace-nowrap">
      {CAT_SOUNDS[idx]}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function TacoBubble({ isSignedIn }: { isSignedIn: boolean }) {
  const hidden = useIsHidden();
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<BubbleMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [nudge, setNudge] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subtle bounce nudge after 30s to let users know Taco is here
  useEffect(() => {
    if (!isSignedIn) return;
    const t = setTimeout(() => setNudge(true), 30_000);
    return () => clearTimeout(t);
  }, [isSignedIn]);

  // Greeting on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]!;
      setMessages([{ id: msgId++, role: 'assistant', content: greeting }]);
    }
    if (open) {
      // Slightly longer delay on mobile so keyboard doesn't fire before panel is visible
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Lock body scroll on mobile when panel is open
  useScrollLock(open);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      console.log('[TacoBubble] sendMessage', trimmed.slice(0, 80));

      const userMsg: BubbleMessage = { id: msgId++, role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch('/api/taco/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, history, pathname }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? res.statusText ?? 'Request failed');
        }

        const data = (await res.json()) as {
          reply: string;
          suggestions?: { label: string; href: string }[];
        };

        setMessages((prev) => [
          ...prev,
          {
            id: msgId++,
            role: 'assistant',
            content: data.reply ?? 'No response.',
            suggestions: data.suggestions?.length ? data.suggestions : undefined,
          },
        ]);
      } catch (e) {
        console.error('[TacoBubble] sendMessage error', e);
        setMessages((prev) => [
          ...prev,
          {
            id: msgId++,
            role: 'assistant',
            content: `*tucks ears back* Something went wrong. Try again?`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, pathname],
  );

  if (!isSignedIn || hidden) return null;

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Floating avatar button                                              */}
      {/* Positioned using CSS env() so it clears the home indicator on iOS  */}
      {/* ------------------------------------------------------------------ */}
      <button
        onClick={() => {
          setOpen((o) => !o);
          setNudge(false);
        }}
        aria-label="Chat with Taco"
        className={[
          // 44px minimum touch target, centered image inside
          'fixed z-40 flex h-14 w-14 items-center justify-center rounded-full',
          'shadow-xl ring-2 ring-wine/20 transition-all duration-300',
          'hover:scale-110 active:scale-95',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-wine/50',
          'bg-parchment border border-wine/15',
          nudge && !open ? 'animate-bounce' : '',
        ].join(' ')}
        style={{
          // Offset from the bottom, respecting iOS home indicator safe area and native tab bar
          bottom: 'calc(1.5rem + var(--tabbar-h, 0px) + env(safe-area-inset-bottom, 0px))',
          right: 'calc(1.5rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="relative h-10 w-10 overflow-hidden rounded-full">
          <Image
            src="/taco-cat.png"
            alt="Chat with Taco"
            fill
            className="object-cover object-top"
            sizes="40px"
          />
        </div>
        {!open && (
          <CatBadge />
        )}
      </button>

      {/* ------------------------------------------------------------------ */}
      {/* Chat panel                                                          */}
      {/*                                                                     */}
      {/* Mobile  (<sm): full-width sheet anchored at the bottom of the      */}
      {/*   viewport, slides up. Height is capped at 80dvh so it never fills */}
      {/*   the whole screen, and it respects bottom safe areas.             */}
      {/*                                                                     */}
      {/* Desktop (≥sm): fixed panel at bottom-right, 384px wide, 520px max */}
      {/* height — same behaviour as before.                                  */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={[
          'fixed z-40 flex flex-col overflow-hidden shadow-2xl',
          'border border-wine/15 bg-parchment transition-all duration-300',

          // Mobile layout: full-width bottom sheet, rounded top corners only
          'left-0 right-0 bottom-0 rounded-t-2xl',
          // Desktop layout: right-aligned floating panel, 384px wide, fully rounded
          'sm:left-auto sm:w-96 sm:right-6 sm:rounded-2xl',
          // Desktop bottom offset: clear the button (h-14=3.5rem) + gap (1.5rem) + spacing
          'sm:bottom-24',

          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-4 opacity-0',
        ].join(' ')}
        style={{
          // Mobile: up to 80% of the dynamic viewport height (accounts for browser chrome + keyboard)
          // Desktop: fixed 520px cap
          maxHeight: 'min(80dvh, 520px)',
          // On desktop, fix the width to 384px
          // (Tailwind sm:w-96 = 24rem = 384px handled by the sm:left-auto + sm:right-6 combo above)
        }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-wine/15 bg-white/60 px-4 py-3 backdrop-blur-sm">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-wine/20">
            <Image
              src="/taco-cat.png"
              alt="Taco"
              fill
              className="object-cover object-top"
              sizes="32px"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border border-parchment" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-wine leading-none mb-0.5">Taco the cat</p>
            <p className="text-[10px] text-ink/50 font-serif">Taco the Cat</p>
          </div>
          {/* Expand to full page — 44px touch target */}
          <Link
            href="/taco"
            onClick={() => setOpen(false)}
            title="Open full Taco studio"
            className="flex h-11 w-11 items-center justify-center text-ink/30 hover:text-wine transition-colors"
          >
            <Maximize2 className="h-4 w-4" />
          </Link>
          {/* Close — 44px touch target */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="flex h-11 w-11 items-center justify-center text-ink/30 hover:text-wine transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages — flex-1 + min-h-0 lets it shrink to share space with input */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4">
          {messages.map((msg) =>
            msg.role === 'assistant' ? (
              <AssistantMessage
                key={msg.id}
                message={msg}
                onNavigate={(href) => {
                  router.push(href);
                  setOpen(false);
                }}
              />
            ) : (
              <UserMessage key={msg.id} content={msg.content} />
            ),
          )}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input — pb accounts for iOS home indicator when the panel is at the bottom */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex shrink-0 items-center gap-2 border-t border-wine/15 bg-white/40 px-3 pt-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {/*
           * font-size must be ≥ 16px on iOS or Safari auto-zooms the viewport.
           * We use text-base (16px) here instead of text-sm (14px).
           */}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Taco anything…"
            className="min-w-0 flex-1 rounded-xl border border-wine/20 bg-white/70 px-3 py-2.5 text-base font-serif text-ink placeholder-ink/30 outline-none focus:border-wine/50 focus:ring-1 focus:ring-wine/30"
            maxLength={400}
            // Prevent iOS double-tap zoom on the input
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck={false}
          />
          {/* 44px touch target for the send button */}
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wine text-parchment transition-colors hover:bg-wine/80 active:bg-wine/90 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile backdrop — tapping outside closes the panel                 */}
      {/* ------------------------------------------------------------------ */}
      {open && (
        <div
          className="fixed inset-0 z-30 sm:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function AssistantMessage({
  message,
  onNavigate,
}: {
  message: BubbleMessage;
  onNavigate: (href: string) => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
        <Image src="/taco-cat.png" alt="" fill className="object-cover object-top" sizes="24px" />
      </div>
      <div className="flex flex-col gap-1.5 max-w-[82%]">
        <div className="rounded-2xl rounded-bl-sm bg-white border border-wine/10 px-3 py-2 text-sm font-serif text-ink leading-relaxed shadow-xs">
          <div className="prose prose-sm max-w-none font-serif text-[13px] leading-relaxed prose-p:my-0.5 prose-ul:my-0.5 prose-li:my-0 prose-strong:text-wine prose-a:text-wine">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onNavigate(s.href)}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-wine/20 bg-wine/5 px-2.5 py-1 text-[12px] font-serif text-wine hover:bg-wine hover:text-parchment active:bg-wine active:text-parchment transition-colors"
              >
                {s.label}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-wine px-3 py-2 text-sm font-serif text-parchment leading-relaxed">
        {content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
        <Image src="/taco-cat.png" alt="" fill className="object-cover object-top" sizes="24px" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-wine/10 bg-white px-3 py-2 shadow-xs">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/50 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/50 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/50 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
