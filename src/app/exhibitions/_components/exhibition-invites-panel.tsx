'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Mail, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import {
  cancelExhibitionInvite,
  resendExhibitionInvite,
  type ExhibitionArtistInviteRow,
} from '../_actions/manage-exhibition-invites';

function statusLabel(status: string): string {
  switch (status) {
    case 'consumed':
      return 'Submitted';
    case 'sent':
    case 'pending':
      return 'Invite sent';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    default:
      return status;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'consumed':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'sent':
    case 'pending':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'cancelled':
    case 'expired':
      return 'bg-ink/5 text-ink/50 border-ink/15';
    default:
      return 'bg-ink/5 text-ink/60 border-ink/15';
  }
}

type ExhibitionInvitesPanelProps = {
  initialInvites: ExhibitionArtistInviteRow[];
};

export function ExhibitionInvitesPanel({
  initialInvites,
}: ExhibitionInvitesPanelProps) {
  const [invites, setInvites] = useState(initialInvites);
  const [pending, startTransition] = useTransition();

  const handleResend = (inviteId: string) => {
    startTransition(async () => {
      const result = await resendExhibitionInvite(inviteId);
      if (result.success) {
        toast.success('Invite resent');
      } else {
        toast.error(result.error || 'Could not resend invite');
      }
    });
  };

  const handleCancel = (inviteId: string) => {
    startTransition(async () => {
      const result = await cancelExhibitionInvite(inviteId);
      if (result.success) {
        setInvites((prev) =>
          prev.map((inv) =>
            inv.id === inviteId ? { ...inv, status: 'cancelled' } : inv,
          ),
        );
        toast.success('Invite cancelled');
      } else {
        toast.error(result.error || 'Could not cancel invite');
      }
    });
  };

  if (invites.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 pt-10 border-t border-wine/15">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">
          Artist invites
        </p>
        <h2 className="text-2xl font-display font-bold text-ink">
          Email invitations
        </h2>
        <p className="text-ink/55 font-serif text-sm mt-2 max-w-2xl">
          Track artists invited by email. When they submit, their Certificate of
          Authenticity and your Certificate of Show are linked to this exhibition.
        </p>
      </div>

      <div className="rounded-lg border border-wine/15 overflow-hidden">
        <ul className="divide-y divide-wine/10">
          {invites.map((invite) => {
            const isOpen =
              invite.status === 'sent' || invite.status === 'pending';
            const isSubmitted = invite.status === 'consumed';

            return (
              <li
                key={invite.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-parchment/40"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Mail className="h-4 w-4 text-wine/60 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-serif text-sm text-ink truncate">
                      {invite.invitee_name || invite.invitee_email}
                    </p>
                    <p className="font-serif text-xs text-ink/50 truncate">
                      {invite.invitee_email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span
                    className={`text-[11px] uppercase tracking-wide font-serif px-2 py-0.5 rounded border ${statusClass(invite.status)}`}
                  >
                    {statusLabel(invite.status)}
                  </span>

                  {isSubmitted && invite.result_artwork_id && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="font-serif text-xs h-8"
                    >
                      <Link href={`/artworks/${invite.result_cos_artwork_id ?? invite.result_artwork_id}/certificate`}>
                        View COS
                      </Link>
                    </Button>
                  )}

                  {isOpen && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleResend(invite.id)}
                        className="font-serif text-xs h-8 gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Resend
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleCancel(invite.id)}
                        className="font-serif text-xs h-8 gap-1 text-ink/60 hover:text-wine"
                      >
                        <XCircle className="h-3 w-3" />
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
