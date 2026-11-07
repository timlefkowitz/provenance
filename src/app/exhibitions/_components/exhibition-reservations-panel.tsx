'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { formatPhone, phoneHref } from '~/lib/phone';

import {
  respondToReservationRequest,
  type ReservationRequest,
} from '../_actions/reservation-requests';

const STATUS_LABEL: Record<ReservationRequest['status'], string> = {
  pending: 'Pending',
  accepted: 'Reserved',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

/** Organiser-only list of "request to reserve" asks for this show. */
export function ExhibitionReservationsPanel({ requests }: { requests: ReservationRequest[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (requests.length === 0) return null;

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const visible = showAll ? requests : requests.filter((r) => r.status === 'pending');
  const list = visible.length > 0 ? visible : requests.slice(0, 5);

  const respond = (id: string, status: 'accepted' | 'declined') => {
    setBusyId(id);
    startTransition(async () => {
      const res = await respondToReservationRequest(id, status);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(status === 'accepted' ? 'Marked as reserved' : 'Request declined');
      router.refresh();
    });
  };

  return (
    <section
      id="reservations"
      className="mb-8 rounded-lg border border-wine/15 bg-parchment/60 px-4 py-4 font-serif"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-[10px] uppercase tracking-widest text-ink/50">
          Reservation requests
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-wine text-parchment px-2 py-0.5 text-[10px]">
              {pendingCount} new
            </span>
          )}
        </h2>
        {requests.length > pendingCount && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-wine underline underline-offset-4"
          >
            {showAll ? 'Show pending only' : `Show all (${requests.length})`}
          </button>
        )}
      </div>

      <ul className="divide-y divide-wine/10">
        {list.map((r) => (
          <li key={r.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-ink">
                <span className="font-semibold">{r.requester_name}</span>{' '}
                <span className="text-ink/50">wants to reserve</span>{' '}
                <Link
                  href={`/artworks/${r.artwork_id}/certificate`}
                  className="text-wine underline-offset-4 hover:underline"
                >
                  {r.artwork_title || 'Untitled'}
                </Link>
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink/55">
                {r.requester_phone && (
                  <a href={phoneHref(r.requester_phone)} className="hover:text-wine">
                    {formatPhone(r.requester_phone)}
                  </a>
                )}
                {r.requester_email && (
                  <a href={`mailto:${r.requester_email}`} className="hover:text-wine break-all">
                    {r.requester_email}
                  </a>
                )}
                <span className="text-ink/35">
                  {new Date(r.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </p>
              {r.message && <p className="mt-1 text-xs text-ink/60 whitespace-pre-line">{r.message}</p>}
            </div>
            {r.status === 'pending' ? (
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-wine text-parchment hover:bg-wine/90"
                  disabled={pending && busyId === r.id}
                  onClick={() => respond(r.id, 'accepted')}
                >
                  Reserve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-wine/25"
                  disabled={pending && busyId === r.id}
                  onClick={() => respond(r.id, 'declined')}
                >
                  Decline
                </Button>
              </div>
            ) : (
              <span className="shrink-0 text-xs text-ink/45">{STATUS_LABEL[r.status]}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
