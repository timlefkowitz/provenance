'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Send, Sparkles, Loader2 } from 'lucide-react';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

type OpportunitiesChatbotProps = {
  hasCv: boolean;
  onOpportunitiesUpdated?: () => void;
};

const QUICK_PROMPTS = [
  'Find grants for me',
  'Show me open residencies',
  'Find open calls I can apply to',
];

export function OpportunitiesChatbot({ hasCv, onOpportunitiesUpdated }: OpportunitiesChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    hasCv
      ? [
          {
            role: 'assistant',
            content:
              'I\'ll search Provenance and the web for grants, open calls, and residencies matched to your profile. Try "Find grants for me" or ask for something specific.',
          },
        ]
      : [
          {
            role: 'assistant',
            content:
              'Upload your CV first so I can match opportunities to your practice. Once uploaded, click "Find opportunities" to get started.',
          },
        ],
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to the latest message whenever messages change
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
          { role: 'assistant', content: data.reply || 'No response.' },
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
    <Card className="border-wine/20 bg-parchment/60 flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg text-wine flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Opportunities assistant
        </CardTitle>
        <p className="text-xs text-ink/60 font-serif">
          Searches Provenance + the web for grants, open calls &amp; residencies
        </p>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 p-4 pt-0 gap-3">
        {/* Message history */}
        <div className="overflow-y-auto space-y-3 min-h-[180px] max-h-[360px]">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm font-serif whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-wine/10 text-ink ml-6'
                  : 'bg-wine/5 text-ink/90 mr-6'
              }`}
            >
              {m.content}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-ink/50 font-serif mr-6 px-3 py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching for opportunities…
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt chips (only shown when no user messages yet) */}
        {hasCv && messages.filter((m) => m.role === 'user').length === 0 && !loading && (
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs font-serif border border-wine/30 rounded-full px-3 py-1 text-wine/80 hover:bg-wine/10 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder={hasCv ? 'Ask for grants, residencies…' : 'Upload your CV first'}
            disabled={loading || !hasCv}
            className="flex-1 border border-wine/30 rounded px-3 py-2 text-sm font-serif bg-white text-ink placeholder:text-ink/50 disabled:opacity-50"
          />
          <Button
            size="sm"
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim() || !hasCv}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {/* Note about agentic search */}
        {hasCv && (
          <p className="text-[11px] text-ink/40 font-serif text-center">
            The assistant searches multiple sources — this may take 10–20 seconds.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
