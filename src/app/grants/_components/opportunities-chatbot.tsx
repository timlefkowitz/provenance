'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Send, Loader2, ExternalLink, FileText } from 'lucide-react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  proposalId?: string | null;
};

type OpportunitiesChatbotProps = {
  hasCv: boolean;
  onOpportunitiesUpdated?: () => void;
};

const QUICK_PROMPTS = [
  'Find grants for me',
  'Show me open residencies',
  'Find open calls I can apply to',
  'Draft a proposal for a grant',
];

export function OpportunitiesChatbot({ hasCv, onOpportunitiesUpdated }: OpportunitiesChatbotProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    hasCv
      ? [
          {
            role: 'assistant',
            content:
              "I'll search Provenance and the web for grants, open calls, and residencies matched to your profile. I can also **draft a proposal** for any grant — just ask!",
          },
        ]
      : [
          {
            role: 'assistant',
            content:
              'Upload your CV first so I can match opportunities to your practice. Once uploaded, ask me to find grants or draft a proposal.',
          },
        ],
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      console.log('[Opportunities] chatbot sendMessage', text.trim().slice(0, 60));
      const userMessage: ChatMessage = { role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setLoading(true);

      try {
        const res = await fetch('/api/opportunities/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            history: messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || res.statusText || 'Request failed');
        }

        const data = await res.json();

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply || 'No response.',
            proposalId: data.newProposalId ?? null,
          },
        ]);

        if (data.newOpportunities?.length) {
          console.log(
            '[Opportunities] chatbot received',
            data.newOpportunities.length,
            'new opportunities',
          );
          onOpportunitiesUpdated?.();
        }
      } catch (e) {
        console.error('[Opportunities] chatbot error', e);
        const message = e instanceof Error ? e.message : 'Something went wrong';
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${message}` },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, onOpportunitiesUpdated],
  );

  return (
    <Card className="border-wine/20 bg-gradient-to-b from-parchment/80 to-parchment/40 shadow-sm flex flex-col">
      <CardHeader className="pb-3 border-b border-wine/8">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Image
              src="/taco-cat.png"
              alt="Taco the cat"
              width={40}
              height={40}
              className="rounded-full object-cover ring-2 ring-wine/15 shadow-sm"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white" />
          </div>
          <div>
            <CardTitle className="font-display text-lg text-wine leading-none mb-0.5">
              Taco the cat
            </CardTitle>
            <p className="text-[11px] text-ink/50 font-serif">
              Finds grants · Drafts proposals
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-0 gap-0">
        {/* Message history */}
        <div className="overflow-y-auto space-y-4 min-h-[320px] max-h-[55vh] p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {m.role === 'assistant' && (
                <Image
                  src="/taco-cat.png"
                  alt="Taco"
                  width={24}
                  height={24}
                  className="rounded-full object-cover ring-1 ring-wine/15 shrink-0 mt-0.5"
                />
              )}
              <div
                className={`rounded-2xl px-4 py-3 max-w-[85%] ${
                  m.role === 'user'
                    ? 'bg-wine text-parchment rounded-tr-sm'
                    : 'bg-white border border-wine/10 text-ink rounded-tl-sm shadow-xs'
                }`}
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none font-serif text-[15px] leading-relaxed prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-wine prose-a:text-wine prose-headings:font-display prose-headings:text-wine">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="font-serif text-[15px] leading-relaxed">{m.content}</p>
                )}

                {/* Proposal CTA */}
                {m.proposalId && (
                  <div className="mt-3 pt-3 border-t border-wine/10">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/grants/proposals/${m.proposalId}`)}
                      className="bg-wine text-parchment hover:bg-wine/90 font-serif gap-1.5 text-xs h-8"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Open your draft
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2.5">
              <Image
                src="/taco-cat.png"
                alt="Taco"
                width={24}
                height={24}
                className="rounded-full object-cover ring-1 ring-wine/15 shrink-0"
              />
              <div className="bg-white border border-wine/10 rounded-2xl rounded-tl-sm px-4 py-3 shadow-xs">
                <div className="flex items-center gap-2 text-sm text-ink/50 font-serif">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-wine/60" />
                  Searching and thinking…
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts */}
        {hasCv && messages.filter((m) => m.role === 'user').length === 0 && !loading && (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs font-serif border border-wine/25 rounded-full px-3 py-1.5 text-wine/75 hover:bg-wine/8 hover:border-wine/40 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="p-3 border-t border-wine/8 bg-white/60">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder={hasCv ? 'Ask for grants, or ask to draft a proposal…' : 'Upload your CV first'}
              disabled={loading || !hasCv}
              className="flex-1 border border-wine/20 rounded-xl px-4 py-2.5 text-[15px] font-serif bg-white text-ink placeholder:text-ink/40 disabled:opacity-50 focus:outline-none focus:border-wine/50 transition-colors"
            />
            <Button
              size="sm"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim() || !hasCv}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0 rounded-xl h-auto px-4"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {hasCv && (
            <p className="text-[10px] text-ink/35 font-serif text-center mt-2">
              Multi-source agentic search — may take 10–20 seconds
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
