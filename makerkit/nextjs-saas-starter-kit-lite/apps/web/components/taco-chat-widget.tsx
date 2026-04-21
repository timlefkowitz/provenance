'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface Message {
  id: number;
  role: 'user' | 'taco';
  text: string;
  ts: number;
}

const TACO_GREETINGS = [
  "Mrrrow. You've reached Taco. I'm listening — but make it quick, I might nap.",
  '*stretches, knocks your coffee off the desk* Oh, hi. What do you need?',
  "Purr. I've been expecting you. Mostly because I was already sitting here.",
  "*stares at you for 4 seconds* ...Go on.",
  "Hello. I am Taco. I run this place. Timothy thinks he does but he is wrong.",
];

const TACO_RESPONSES: { keywords: string[]; replies: string[] }[] = [
  {
    keywords: ['price', 'cost', 'plan', 'pricing', 'subscription'],
    replies: [
      "Pricing? *licks paw* Check /pricing. I don't do numbers — I do vibes.",
      "That's a humans question. Timothy handles money. I handle morale.",
      '*yawns* There is a free tier. The rest you can read. Reading is your job.',
    ],
  },
  {
    keywords: ['certificate', 'authenticity', 'coa', 'artwork', 'art'],
    replies: [
      'Certificates of Authenticity are our whole thing. *sits on your keyboard* Artist issues, collector holds, institution verifies. Simple.',
      "Art provenance. My domain. *knocks over vase* Every object deserves a record. Even me, though I am priceless.",
      'Yes, we do CoAs. Yes, they actually work. No, PDFs in email are not sufficient. I have thoughts about email.',
    ],
  },
  {
    keywords: ['gallery', 'galerie', 'exhibition', 'show'],
    replies: [
      "Galleries get exhibitions, open calls, and permissions. *tail flick* It's quite good. We built it properly.",
      'I once attended a gallery opening. The canapés were acceptable. Anyway — yes, galleries have their own tools here.',
      '*peers at you from behind a monitor* Gallery features: exhibitions, staff roles, submission windows. Very thorough.',
    ],
  },
  {
    keywords: ['collector', 'collection', 'own', 'bought', 'purchase'],
    replies: [
      'Collectors build provenance records — ownership history, auction data, private drafts. *blinks slowly* Very dignified.',
      "You collect things? I collect nap spots. But your records will be more defensible than a receipt in a drawer.",
      '*sits directly on your collection documents* Noted. We can help with that.',
    ],
  },
  {
    keywords: ['institution', 'museum', 'foundation', 'university'],
    replies: [
      'Institution-grade tools: loans, invoicing, accessioning, audit trails. I personally audited nothing but I supervised.',
      "*very serious face* Museums require structure. We have structure. Also API keys. Very institutional of us.",
      'Yes, institutions. Scoped permissions, append-only logs. I sat on the design docs. Literally.',
    ],
  },
  {
    keywords: ['hello', 'hi', 'hey', 'hola', 'greetings'],
    replies: [
      '*slow blink* Hello. You may proceed.',
      "Hi. I'm Taco. Chief Vibes Officer. This is my platform now.",
      '*ears perk up* Oh, a new human. Interesting.',
    ],
  },
  {
    keywords: ['help', 'support', 'stuck', 'problem', 'issue', 'bug'],
    replies: [
      "For real support: team@provenance.app. I would help but I have paws and limited email access.",
      '*headbutts your screen gently* Contact the actual humans. I'm here for emotional support only.",
      "I don't do tickets. I do comfort. Reach out to the team — they're quite good.",
    ],
  },
  {
    keywords: ['taco', 'cat', 'who are you', 'what are you'],
    replies: [
      "*stands up very tall* I am Taco. Chief Vibes Officer. I have been here since the beginning. I will be here at the end.",
      "Taco. The cat. I oversee everything, approve nothing, and my approval is meaningless but deeply desired.",
      '*flops over* I am Taco. I am also perfect. These two things are related.',
    ],
  },
  {
    keywords: ['api', 'integration', 'developer', 'webhook', 'key'],
    replies: [
      "API access exists. Scoped keys, verification endpoints. *yawns* Very developer-friendly. I don't use it personally.",
      'We have an API. Timothy explained it to me once. I stared at him and then looked out the window.',
      "*knocks API docs off desk* They're still there. On the floor. You can read them.",
    ],
  },
];

const FALLBACK_REPLIES = [
  "*tilts head* Interesting question. I'll think about it... *sits down and stares into the middle distance*",
  'Hmm. *begins grooming* You should probably ask a human about that. I deal in vibes, not specifics.',
  "*slow blink* I don't have a great answer for that. But I respect the question.",
  '*chirps* I heard that. I'm thinking. *falls asleep briefly* Sorry, what were we discussing?',
  "That's above my pay grade. I don't technically have a pay grade. I have treats.",
];

function getTacoReply(userText: string): string {
  const lower = userText.toLowerCase();
  for (const group of TACO_RESPONSES) {
    if (group.keywords.some((k) => lower.includes(k))) {
      return group.replies[Math.floor(Math.random() * group.replies.length)]!;
    }
  }
  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)]!;
}

let msgIdCounter = 1;

export function TacoChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [nudge, setNudge] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initial greeting when first opened
  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting =
        TACO_GREETINGS[Math.floor(Math.random() * TACO_GREETINGS.length)]!;
      setMessages([
        {
          id: msgIdCounter++,
          role: 'taco',
          text: greeting,
          ts: Date.now(),
        },
      ]);
    }
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, messages.length]);

  // Subtle nudge on the button after 30s
  useEffect(() => {
    const t = setTimeout(() => setNudge(true), 30_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');

    const userMsg: Message = {
      id: msgIdCounter++,
      role: 'user',
      text,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Simulate Taco "typing"
    setTyping(true);
    const delay = 900 + Math.random() * 800;
    setTimeout(() => {
      setTyping(false);
      const reply = getTacoReply(text);
      setMessages((prev) => [
        ...prev,
        { id: msgIdCounter++, role: 'taco', text: reply, ts: Date.now() },
      ]);
    }, delay);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => {
          setOpen((o) => !o);
          setNudge(false);
        }}
        aria-label="Chat with Taco"
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl ring-2 ring-pink-400/30 transition-all duration-300 hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400 ${
          nudge ? 'animate-bounce' : ''
        }`}
        style={{ background: '#1a0a14' }}
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
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[9px] font-bold text-white shadow">
            ?
          </span>
        )}
      </button>

      {/* Chat panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 flex w-80 flex-col overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 sm:w-96 ${
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-4 opacity-0'
        }`}
        style={{ maxHeight: '520px', background: '#0f0a0d' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 border-b border-pink-900/40 px-4 py-3"
          style={{ background: '#1a0a14' }}
        >
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-pink-500/40">
            <Image
              src="/taco-cat.png"
              alt="Taco"
              fill
              className="object-cover object-top"
              sizes="36px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Taco</p>
            <p className="text-xs text-pink-400/80">Chief Vibes Officer</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="text-pink-300/60 transition-colors hover:text-pink-300"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          style={{ maxHeight: '360px' }}
        >
          {messages.map((msg) =>
            msg.role === 'taco' ? (
              <TacoMessage key={msg.id} text={msg.text} />
            ) : (
              <UserMessage key={msg.id} text={msg.text} />
            ),
          )}
          {typing && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-center gap-2 border-t border-pink-900/40 px-3 py-3"
          style={{ background: '#1a0a14' }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Taco anything…"
            className="min-w-0 flex-1 rounded-xl border border-pink-900/40 bg-white/5 px-3 py-2 text-sm text-white placeholder-pink-300/30 outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/40"
            maxLength={300}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-600 text-white transition-colors hover:bg-pink-500 disabled:opacity-40"
            aria-label="Send"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}

function TacoMessage({ text }: { text: string }) {
  return (
    <div className="flex items-end gap-2">
      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
        <Image
          src="/taco-cat.png"
          alt=""
          fill
          className="object-cover object-top"
          sizes="24px"
        />
      </div>
      <div
        className="max-w-[75%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed text-pink-50"
        style={{ background: '#2d1222' }}
      >
        {text}
      </div>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-pink-600 px-3 py-2 text-sm leading-relaxed text-white">
        {text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
        <Image
          src="/taco-cat.png"
          alt=""
          fill
          className="object-cover object-top"
          sizes="24px"
        />
      </div>
      <div
        className="flex items-center gap-1 rounded-2xl rounded-bl-sm px-3 py-2"
        style={{ background: '#2d1222' }}
      >
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-400 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
