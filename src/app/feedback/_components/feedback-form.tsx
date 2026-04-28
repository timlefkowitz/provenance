'use client';

import { useState, useTransition, useEffect } from 'react';
import { Bug, Lightbulb, MessageCircleHeart, HelpCircle, Sparkles, EyeOff, Eye, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Switch } from '@kit/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';
import { submitFeedback } from '../_actions/submit-feedback';

type Category = 'bug' | 'idea' | 'praise' | 'question' | 'other';

const CATEGORIES: {
  value: Category;
  label: string;
  description: string;
  Icon: typeof Bug;
}[] = [
  {
    value: 'bug',
    label: 'Bug',
    description: 'Something is broken or behaves unexpectedly.',
    Icon: Bug,
  },
  {
    value: 'idea',
    label: 'Idea',
    description: 'A feature or improvement you would like to see.',
    Icon: Lightbulb,
  },
  {
    value: 'praise',
    label: 'Praise',
    description: 'Tell us what you love so we keep doing it.',
    Icon: MessageCircleHeart,
  },
  {
    value: 'question',
    label: 'Question',
    description: 'Need help understanding how something works.',
    Icon: HelpCircle,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Anything else on your mind.',
    Icon: Sparkles,
  },
];

type Props = {
  defaultEmail: string | null;
  defaultName: string | null;
};

export function FeedbackForm({ defaultEmail, defaultName }: Props) {
  const [category, setCategory] = useState<Category>('idea');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [pageUrl, setPageUrl] = useState('');
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Default to the referring page if the user navigated here from
    // somewhere on the site — handy for bug reports.
    if (typeof window !== 'undefined' && document.referrer) {
      try {
        const url = new URL(document.referrer);
        if (url.origin === window.location.origin) {
          setPageUrl(url.pathname + url.search);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!message.trim()) {
      setError('Please write a message.');
      return;
    }

    startTransition(async () => {
      const res = await submitFeedback({
        message,
        category,
        subject: subject.trim() || null,
        pageUrl: pageUrl.trim() || null,
        isAnonymous,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      setSubmittedTicketId(res.ticketId);
      setMessage('');
      setSubject('');
    });
  }

  if (submittedTicketId) {
    return (
      <Card className="border-wine/20 bg-parchment/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-wine/10">
            <CheckCircle2 className="h-7 w-7 text-wine" aria-hidden />
          </div>
          <CardTitle className="font-display text-2xl text-wine">
            Thank you
          </CardTitle>
          <CardDescription className="font-serif text-base text-ink/80">
            Your feedback has been delivered. The team will review it
            shortly{isAnonymous ? '' : ' and may follow up with you'}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <p className="font-mono text-xs text-ink/50">
            Ticket #{submittedTicketId.slice(0, 8)}
          </p>
          <Button
            type="button"
            variant="outline"
            className="font-serif border-wine/30"
            onClick={() => setSubmittedTicketId(null)}
          >
            Send another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Category picker */}
      <fieldset className="space-y-3">
        <legend className="font-display text-sm font-semibold uppercase tracking-wider text-wine/80">
          What kind of feedback?
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CATEGORIES.map(({ value, label, description, Icon }) => {
            const active = category === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                aria-pressed={active}
                title={description}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-center transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40',
                  active
                    ? 'border-wine bg-wine text-parchment shadow-sm'
                    : 'border-wine/20 bg-parchment/40 text-ink hover:border-wine/40 hover:bg-parchment/70',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="font-display text-sm">{label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Subject (optional) */}
      <div className="space-y-2">
        <Label htmlFor="feedback-subject" className="font-serif">
          Subject <span className="text-ink/50">(optional)</span>
        </Label>
        <Input
          id="feedback-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="A short headline"
          maxLength={200}
          className="font-serif"
        />
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="feedback-message" className="font-serif">
          Message
        </Label>
        <Textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us as much as you'd like. Specifics help — what you tried, what you expected, what happened."
          required
          rows={8}
          maxLength={8000}
          className="font-serif resize-y"
        />
        <p className="text-xs text-ink/50 font-serif tabular-nums">
          {message.length.toLocaleString()} / 8,000
        </p>
      </div>

      {/* Page URL */}
      <div className="space-y-2">
        <Label htmlFor="feedback-url" className="font-serif">
          Page <span className="text-ink/50">(optional)</span>
        </Label>
        <Input
          id="feedback-url"
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          placeholder="/artworks/abc-123"
          className="font-serif font-mono text-sm"
        />
        <p className="text-xs text-ink/60 font-serif">
          If your feedback is about a specific page, paste the path so the team can jump straight there.
        </p>
      </div>

      {/* Anonymous toggle */}
      <div className="flex items-start gap-4 rounded-lg border border-wine/20 bg-parchment/40 p-4">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine">
          {isAnonymous ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4">
            <Label
              htmlFor="feedback-anonymous"
              className="font-display text-base text-wine cursor-pointer"
            >
              Send anonymously
            </Label>
            <Switch
              id="feedback-anonymous"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
          </div>
          <p className="mt-1 font-serif text-sm text-ink/70">
            {isAnonymous
              ? 'Your name and email will not be attached to this ticket. The team will not be able to follow up with you.'
              : defaultName || defaultEmail
                ? `Submitting as ${defaultName ?? defaultEmail}.`
                : 'Submitting as the signed-in account.'}
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 font-serif text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-serif text-sm text-ink/60">
          We read every ticket. Quality always over quantity.
        </p>
        <Button
          type="submit"
          disabled={isPending || !message.trim()}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif gap-2"
        >
          <Send className="h-4 w-4" aria-hidden />
          {isPending ? 'Sending…' : 'Send feedback'}
        </Button>
      </div>
    </form>
  );
}
