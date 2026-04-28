'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bug,
  Lightbulb,
  MessageCircleHeart,
  HelpCircle,
  Sparkles,
  EyeOff,
  Globe,
  Inbox,
  CircleDot,
  CheckCircle2,
  Archive,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Textarea } from '@kit/ui/textarea';
import { Badge } from '@kit/ui/badge';
import { cn } from '@kit/ui/utils';
import {
  type AdminFeedbackTicket,
  type FeedbackStatusCounts,
  type FeedbackTicketStatus,
  saveFeedbackTicketNotes,
  updateFeedbackTicketStatus,
} from '../_actions/admin-feedback';

const CATEGORY_ICON: Record<string, typeof Bug> = {
  bug: Bug,
  idea: Lightbulb,
  praise: MessageCircleHeart,
  question: HelpCircle,
  other: Sparkles,
};

const STATUS_FILTERS: {
  value: FeedbackTicketStatus | 'all';
  label: string;
  Icon: typeof Inbox;
}[] = [
  { value: 'all', label: 'All', Icon: Inbox },
  { value: 'open', label: 'Open', Icon: CircleDot },
  { value: 'reviewing', label: 'Reviewing', Icon: Sparkles },
  { value: 'resolved', label: 'Resolved', Icon: CheckCircle2 },
  { value: 'archived', label: 'Archived', Icon: Archive },
];

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusTone(status: FeedbackTicketStatus): string {
  switch (status) {
    case 'open':
      return 'bg-wine text-parchment border-wine';
    case 'reviewing':
      return 'bg-amber-100 text-amber-900 border-amber-300';
    case 'resolved':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    case 'archived':
      return 'bg-ink/10 text-ink/70 border-ink/20';
  }
}

type Props = {
  tickets: AdminFeedbackTicket[];
  counts: FeedbackStatusCounts;
  activeFilter: FeedbackTicketStatus | 'all';
};

export function FeedbackTicketsList({ tickets, counts, activeFilter }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(next: FeedbackTicketStatus | 'all') {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    const qs = params.toString();
    router.replace(`/admin/feedback${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="space-y-6">
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ value, label, Icon }) => {
          const count =
            value === 'all' ? counts.total : counts[value as FeedbackTicketStatus];
          const active = activeFilter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-serif text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40',
                active
                  ? 'border-wine bg-wine text-parchment'
                  : 'border-wine/25 bg-parchment/60 text-ink hover:border-wine/50',
              )}
              aria-pressed={active}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{label}</span>
              <span
                className={cn(
                  'tabular-nums text-xs',
                  active ? 'text-parchment/80' : 'text-ink/60',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {tickets.length === 0 ? (
        <Card className="border-wine/15 bg-parchment/40">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Inbox className="h-10 w-10 text-wine/40" aria-hidden />
            <p className="font-display text-lg text-wine">Nothing to show</p>
            <p className="font-serif text-sm text-ink/70">
              No tickets match this filter yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {tickets.map((t) => (
            <FeedbackTicketCard key={t.id} ticket={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackTicketCard({ ticket }: { ticket: AdminFeedbackTicket }) {
  const Icon = CATEGORY_ICON[ticket.category] ?? Sparkles;
  const [notes, setNotes] = useState(ticket.admin_notes ?? '');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStatus(next: FeedbackTicketStatus) {
    setActionError(null);
    setActionMessage(null);
    startTransition(async () => {
      const res = await updateFeedbackTicketStatus(ticket.id, next);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setActionMessage(`Marked ${next}.`);
    });
  }

  function handleSaveNotes() {
    setActionError(null);
    setActionMessage(null);
    startTransition(async () => {
      const res = await saveFeedbackTicketNotes(ticket.id, notes);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setActionMessage('Notes saved.');
    });
  }

  return (
    <Card
      id={ticket.id}
      className="border-wine/15 bg-parchment/50 scroll-mt-24"
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle className="font-display text-lg text-wine">
                {ticket.subject || (
                  <span className="text-ink/60 italic">
                    {ticket.category[0]?.toUpperCase() + ticket.category.slice(1)}{' '}
                    feedback
                  </span>
                )}
              </CardTitle>
              <CardDescription className="font-serif text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                {ticket.is_anonymous ? (
                  <span className="inline-flex items-center gap-1 text-ink/70">
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                    Anonymous
                  </span>
                ) : (
                  <span className="text-ink/80">
                    {ticket.submitter_name || ticket.submitter_email || 'Signed-in user'}
                  </span>
                )}
                {!ticket.is_anonymous && ticket.submitter_email && (
                  <a
                    href={`mailto:${ticket.submitter_email}`}
                    className="text-wine hover:underline"
                  >
                    {ticket.submitter_email}
                  </a>
                )}
                <span className="text-ink/50">·</span>
                <span className="text-ink/70">{formatWhen(ticket.created_at)}</span>
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn('font-serif text-xs', statusTone(ticket.status))}
          >
            {ticket.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap rounded-md border border-wine/10 bg-parchment/70 p-4 font-serif text-ink">
          {ticket.message}
        </p>

        {(ticket.page_url || ticket.user_agent) && (
          <dl className="grid gap-2 rounded-md border border-ink/10 bg-parchment/40 p-3 font-mono text-xs text-ink/70 sm:grid-cols-[auto_1fr] sm:gap-x-3">
            {ticket.page_url && (
              <>
                <dt className="inline-flex items-center gap-1 text-ink/60">
                  <Globe className="h-3 w-3" aria-hidden /> page
                </dt>
                <dd className="break-all">{ticket.page_url}</dd>
              </>
            )}
            {ticket.user_agent && (
              <>
                <dt className="text-ink/60">ua</dt>
                <dd className="break-all">{ticket.user_agent}</dd>
              </>
            )}
          </dl>
        )}

        <div className="space-y-2">
          <label
            htmlFor={`notes-${ticket.id}`}
            className="block font-display text-xs font-semibold uppercase tracking-wider text-wine/70"
          >
            Internal notes
          </label>
          <Textarea
            id={`notes-${ticket.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for the team — never shown to the submitter."
            rows={2}
            maxLength={4000}
            className="font-serif text-sm"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSaveNotes}
              disabled={isPending || (notes ?? '') === (ticket.admin_notes ?? '')}
              className="font-serif border-wine/30"
            >
              Save notes
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-wine/10 pt-4">
          <div className="flex flex-wrap gap-2">
            {(['open', 'reviewing', 'resolved', 'archived'] as const)
              .filter((s) => s !== ticket.status)
              .map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatus(s)}
                  disabled={isPending}
                  className="font-serif capitalize border-wine/30"
                >
                  Mark {s}
                </Button>
              ))}
          </div>
          <div className="text-right">
            {actionMessage && (
              <p className="font-serif text-xs text-emerald-700">{actionMessage}</p>
            )}
            {actionError && (
              <p className="font-serif text-xs text-red-700">{actionError}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
