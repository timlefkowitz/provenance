'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Send, MessageCircle } from 'lucide-react';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

type GrantsChatbotProps = {
  hasCv: boolean;
  onGrantsUpdated?: () => void;
};

export function GrantsChatbot({ hasCv, onGrantsUpdated }: GrantsChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    hasCv
      ? [{ role: 'assistant', content: 'Ask me to find grants or refine by location, discipline, or deadline. Try "Find grants for me" or "Show me residencies in California."' }]
      : [{ role: 'assistant', content: 'Upload your CV first, then click "Find grants" to get started.' }]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      console.log('[Grants] chatbot sendMessage', text.trim().slice(0, 50));
      const userMessage: ChatMessage = { role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setLoading(true);

      try {
        const res = await fetch('/api/grants/chat', {
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
        if (data.newGrants?.length) {
          console.log('[Grants] chatbot received', data.newGrants.length, 'new grants');
          onGrantsUpdated?.();
        }
      } catch (e) {
        console.error('[Grants] chatbot error', e);
        const message = e instanceof Error ? e.message : 'Something went wrong';
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${message}` }]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, onGrantsUpdated]
  );

  const handleFindGrants = useCallback(() => {
    sendMessage('Find grants for me based on my CV.');
  }, [sendMessage]);

  return (
    <Card className="border-wine/20 bg-parchment/60 h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg text-wine flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Grant assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0 p-4 pt-0">
        <div className="flex-1 overflow-y-auto space-y-3 min-h-[200px] max-h-[320px] mb-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm font-serif ${
                m.role === 'user'
                  ? 'bg-wine/10 text-ink ml-4'
                  : 'bg-wine/5 text-ink/90 mr-4'
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask for grants..."
            className="flex-1 border border-wine/30 rounded px-3 py-2 text-sm font-serif bg-white text-ink placeholder:text-ink/50"
          />
          <Button
            size="sm"
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {hasCv && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full font-serif border-wine/30 hover:bg-wine/10"
            onClick={handleFindGrants}
            disabled={loading}
          >
            Find grants
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
