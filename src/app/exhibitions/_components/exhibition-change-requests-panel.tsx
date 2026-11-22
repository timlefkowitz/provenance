'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import {
  respondToChangeRequest,
  type OrganiserChangeRequest,
} from '../_actions/exhibition-change-requests';
import { Eyebrow } from '~/components/editorial-form';

function statusLabel(status: OrganiserChangeRequest['status']): string {
  switch (status) {
    case 'pending':
      return 'Waiting for you';
    case 'approved':
      return 'Approved';
    case 'declined':
      return 'Declined';
    case 'withdrawn':
      return 'Withdrawn';
  }
}

function ValueBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="font-jetbrains text-[10px] uppercase tracking-[0.16em] text-editorial-ink/45 mb-1">
        {label}
      </p>
      <p className="font-serif text-sm text-editorial-ink whitespace-pre-line break-words line-clamp-6">
        {value?.trim() ? value : <span className="italic text-editorial-ink/40">Blank</span>}
      </p>
    </div>
  );
}

/**
 * Edit-page panel: changes invited artists asked for on fields the organiser
 * set. Approving applies the value; declining keeps it, with an optional reply.
 */
export function ExhibitionChangeRequestsPanel({
  exhibitionId,
  requests,
}: {
  exhibitionId: string;
  requests: OrganiserChangeRequest[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  if (requests.length === 0) return null;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const respond = (id: string, decision: 'approve' | 'decline') => {
    setBusyId(id);
    startTransition(async () => {
      const result = await respondToChangeRequest(exhibitionId, id, decision, replies[id] ?? null);
      setBusyId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === 'approve' ? 'Change applied' : 'Request declined');
      router.refresh();
    });
  };

  return (
    <section
      id="artist-requests"
      className="mt-12 pt-10 border-t border-editorial-border/20 scroll-mt-8"
    >
      <div className="mb-6">
        <Eyebrow className="mb-3">Artist requests</Eyebrow>
        <h2 className="font-fraunces text-2xl italic tracking-tight text-editorial-ink">
          Changes artists asked for
        </h2>
        <p className="text-editorial-ink/55 font-serif text-sm mt-2 max-w-2xl">
          Invited artists can fill in details you left blank. For anything you set, they ask
          here. Approving updates the exhibition; either way the artist is told.
        </p>
        {pendingCount > 0 && (
          <p className="font-serif text-xs text-vermillion mt-3">
            {pendingCount} waiting for you
          </p>
        )}
      </div>

      <ul className="space-y-4">
        {requests.map((r) => {
          const pending = r.status === 'pending';
          return (
            <li key={r.id} className="border border-editorial-border/20 bg-cream/40 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <p className="font-serif text-sm text-editorial-ink">
                  <span className="font-semibold">{r.artistName}</span> asked to change the{' '}
                  {r.fieldLabel.toLowerCase()}
                </p>
                <span
                  className={`text-[11px] uppercase tracking-wide font-serif px-2 py-0.5 border ${
                    pending
                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                      : r.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-cream/50 text-editorial-ink/50 border-ink/15'
                  }`}
                >
                  {statusLabel(r.status)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ValueBlock label={pending ? 'Now' : 'Was'} value={r.currentValue} />
                <ValueBlock label="Proposed" value={r.proposedValue} />
              </div>

              {r.message && (
                <p className="mt-3 font-serif text-sm text-editorial-ink/75 italic">“{r.message}”</p>
              )}
              {!pending && r.responseMessage && (
                <p className="mt-3 font-serif text-xs text-editorial-ink/60">
                  Your reply: {r.responseMessage}
                </p>
              )}

              {pending && (
                <div className="mt-4 space-y-3">
                  <Textarea
                    value={replies[r.id] ?? ''}
                    onChange={(e) => setReplies((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Optional reply to the artist"
                    rows={2}
                    maxLength={2000}
                    className="font-serif text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => respond(r.id, 'approve')}
                      className="font-serif bg-editorial-ink text-bone hover:bg-vermillion"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve change
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => respond(r.id, 'decline')}
                      className="font-serif"
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Keep current
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
