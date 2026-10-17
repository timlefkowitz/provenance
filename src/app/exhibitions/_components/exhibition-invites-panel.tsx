'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, RefreshCw, Send, XCircle } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import {
  cancelExhibitionInvite,
  inviteCreditedArtists,
  resendExhibitionInvite,
  updateExhibitionInviteLimit,
  type CreditedArtistInviteStatus,
  type ExhibitionArtistInviteRow,
} from '../_actions/manage-exhibition-invites';
import { Eyebrow } from '~/components/editorial-form';

const LIMIT_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

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
      return 'bg-cream/50 text-editorial-ink/50 border-ink/15';
    default:
      return 'bg-cream/50 text-editorial-ink/60 border-ink/15';
  }
}

type ExhibitionInvitesPanelProps = {
  exhibitionId: string;
  initialInvites: ExhibitionArtistInviteRow[];
  uninvitedArtists: CreditedArtistInviteStatus[];
};

export function ExhibitionInvitesPanel({
  exhibitionId,
  initialInvites,
  uninvitedArtists,
}: ExhibitionInvitesPanelProps) {
  const router = useRouter();
  const [invites, setInvites] = useState(initialInvites);
  const [pending, startTransition] = useTransition();

  // Pick up invites created by "Send upload invites" after router.refresh().
  const [syncedInvites, setSyncedInvites] = useState(initialInvites);
  if (syncedInvites !== initialInvites) {
    setSyncedInvites(initialInvites);
    setInvites(initialInvites);
  }

  const invitable = uninvitedArtists.filter((a) => a.hasEmail);
  const missingEmail = uninvitedArtists.filter((a) => !a.hasEmail);

  const handleInviteCredited = () => {
    startTransition(async () => {
      try {
        const result = await inviteCreditedArtists(
          exhibitionId,
          invitable.map((a) => a.artistAccountId),
        );
        if (result.sent > 0) {
          toast.success(
            `Upload ${result.sent === 1 ? 'invite' : 'invites'} sent to ${result.sent} ${result.sent === 1 ? 'artist' : 'artists'}`,
          );
        }
        if (result.errors.length > 0) {
          toast.error(result.errors[0]);
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not send invites');
      }
    });
  };

  const handleLimitChange = (inviteId: string, value: string) => {
    const maxArtworks = value ? Number.parseInt(value, 10) : null;
    const previous = invites;
    setInvites((prev) =>
      prev.map((inv) => (inv.id === inviteId ? { ...inv, max_artworks: maxArtworks } : inv)),
    );
    startTransition(async () => {
      const result = await updateExhibitionInviteLimit(inviteId, maxArtworks);
      if (result.success) {
        toast.success(maxArtworks ? `Limit set to ${maxArtworks}` : 'Limit removed');
      } else {
        setInvites(previous);
        toast.error(result.error || 'Could not update limit');
      }
    });
  };

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

  if (invites.length === 0 && uninvitedArtists.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 pt-10 border-t border-editorial-border/20">
      <div className="mb-6">
        <Eyebrow className="mb-3">Artist invites</Eyebrow>
        <h2 className="font-fraunces text-2xl italic tracking-tight text-editorial-ink">
          Upload invitations
        </h2>
        <p className="text-editorial-ink/55 font-serif text-sm mt-2 max-w-2xl">
          Track artists invited to upload work. Their submissions wait for your review
          below; nothing joins the exhibition until you select it.
        </p>
      </div>

      {uninvitedArtists.length > 0 && (
        <div className="mb-6 border border-amber-200 bg-amber-50/60 px-4 py-4 font-serif">
          <p className="text-sm text-editorial-ink">
            {uninvitedArtists.length === 1 ? 'This artist is' : 'These artists are'} credited but
            {uninvitedArtists.length === 1 ? " hasn't" : " haven't"} been invited to upload:{' '}
            <span className="font-semibold">
              {uninvitedArtists.map((a) => a.name).join(', ')}
            </span>
          </p>
          {missingEmail.length > 0 && (
            <p className="text-xs text-editorial-ink/60 mt-1">
              No email on file for {missingEmail.map((a) => a.name).join(', ')}. Invite them by
              typing their email in the artists field above.
            </p>
          )}
          {invitable.length > 0 && (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={handleInviteCredited}
              className="mt-3 gap-1.5 rounded-none bg-editorial-ink text-bone hover:bg-vermillion font-jetbrains text-[10px] uppercase tracking-[0.16em] h-8"
            >
              <Send className="h-3 w-3" />
              Send upload {invitable.length === 1 ? 'invite' : 'invites'}
            </Button>
          )}
        </div>
      )}

      {invites.length > 0 && (
      <div className="border border-editorial-border/20 overflow-hidden">
        <ul className="divide-y divide-editorial-border/15">
          {invites.map((invite) => {
            const isOpen =
              invite.status === 'sent' || invite.status === 'pending';
            const isSubmitted = invite.status === 'consumed';

            return (
              <li
                key={invite.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-cream/40"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Mail className="h-4 w-4 text-vermillion/80 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-serif text-sm text-editorial-ink truncate">
                      {invite.invitee_name || invite.invitee_email}
                    </p>
                    <p className="font-serif text-xs text-editorial-ink/50 truncate">
                      {invite.invitee_email}
                      {invite.source === 'open_call' && (
                        <span className="ml-2 border border-editorial-border/30 px-1.5 py-px text-[10px] uppercase tracking-wide text-vermillion/80">
                          Open call
                        </span>
                      )}
                      {invite.submitted_count > 0 && (
                        <span className="ml-2 text-editorial-ink/45">
                          {invite.submitted_count} submitted
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                  {isOpen ? (
                    <label className="flex items-center gap-1.5 font-serif text-xs text-editorial-ink/60">
                      Up to
                      <select
                        value={invite.max_artworks ?? ''}
                        disabled={pending}
                        onChange={(e) => handleLimitChange(invite.id, e.target.value)}
                        aria-label={`Upload limit for ${invite.invitee_name || invite.invitee_email}`}
                        className="h-8 rounded-md border border-ink/20 bg-transparent px-2 text-xs text-editorial-ink"
                      >
                        <option value="">No limit</option>
                        {[...new Set([...LIMIT_OPTIONS, ...(invite.max_artworks ? [invite.max_artworks] : [])])]
                          .sort((a, b) => a - b)
                          .map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? 'work' : 'works'}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : invite.max_artworks ? (
                    <span className="font-serif text-xs text-editorial-ink/50">
                      Limit {invite.max_artworks}
                    </span>
                  ) : null}

                  <span
                    className={`text-[11px] uppercase tracking-wide font-serif px-2 py-0.5 border ${statusClass(invite.status)}`}
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
                        className="font-serif text-xs h-8 gap-1 text-editorial-ink/60 hover:text-vermillion"
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
      )}
    </section>
  );
}
