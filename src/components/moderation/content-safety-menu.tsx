'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, Flag, MoreHorizontal } from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { cn } from '@kit/ui/utils';
import { blockUser, reportContent, unblockUser } from '~/app/_actions/moderation';
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from '~/lib/moderation/report-types';

type Props = {
  targetType: ReportTargetType;
  targetId: string;
  /** Owner of the content; enables "Block". Omit when unknown. */
  ownerId?: string | null;
  ownerName?: string | null;
  currentUserId?: string | null;
  isBlocked?: boolean;
  className?: string;
};

const TARGET_LABEL: Record<ReportTargetType, string> = {
  artwork: 'artwork',
  collectible: 'collectible',
  profile: 'profile',
  exhibition: 'exhibition',
  user: 'user',
};

/**
 * "⋯" menu to report content or block its owner (App Store guideline 1.2).
 * Renders nothing on the viewer's own content.
 */
export function ContentSafetyMenu({
  targetType,
  targetId,
  ownerId,
  ownerName,
  currentUserId,
  isBlocked = false,
  className,
}: Props) {
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  if (currentUserId && ownerId && currentUserId === ownerId) return null;

  const who = ownerName?.trim() || 'this user';
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(
    typeof window === 'undefined' ? '/' : window.location.pathname,
  )}`;

  async function submitReport() {
    if (!reason) return;
    setBusy(true);
    const result = await reportContent({
      targetType,
      targetId,
      targetOwnerId: ownerId ?? null,
      reason,
      details,
      pageUrl: window.location.href,
    });
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setReportOpen(false);
    setReason(null);
    setDetails('');
    toast.success('Thanks — our team will review this within 24 hours.');
  }

  async function toggleBlock() {
    if (!ownerId) return;
    setBusy(true);
    const result = isBlocked ? await unblockUser(ownerId) : await blockUser(ownerId);
    setBusy(false);
    setBlockOpen(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(isBlocked ? `Unblocked ${who}.` : `Blocked ${who}. You won’t see their content anymore.`);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8 text-ink/50 hover:text-ink', className)}
            aria-label={`More options for this ${TARGET_LABEL[targetType]}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="font-serif">
          {currentUserId ? (
            <>
              <DropdownMenuItem onSelect={() => setReportOpen(true)}>
                <Flag className="h-4 w-4 mr-2" aria-hidden />
                Report {TARGET_LABEL[targetType]}
              </DropdownMenuItem>
              {ownerId && (
                <DropdownMenuItem
                  onSelect={() => setBlockOpen(true)}
                  className={isBlocked ? undefined : 'text-red-700 focus:text-red-700'}
                >
                  <Ban className="h-4 w-4 mr-2" aria-hidden />
                  {isBlocked ? `Unblock ${who}` : `Block ${who}`}
                </DropdownMenuItem>
              )}
            </>
          ) : (
            <DropdownMenuItem asChild>
              <Link href={signInHref}>
                <Flag className="h-4 w-4 mr-2" aria-hidden />
                Sign in to report or block
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={reportOpen} onOpenChange={(o) => !busy && setReportOpen(o)}>
        <DialogContent className="sm:max-w-md font-serif">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">Report {TARGET_LABEL[targetType]}</DialogTitle>
            <DialogDescription className="font-serif">
              Reports are private. Our team reviews every report within 24 hours and removes content that breaks
              our Terms.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink mb-1">What’s wrong?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm text-ink/80 cursor-pointer">
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-[var(--wine,#6b2d2d)]"
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Anything else we should know? (optional)"
            className="w-full rounded-md border border-ink/20 bg-white/70 px-3 py-2 text-sm"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={busy} onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-wine text-parchment hover:bg-wine/90" disabled={!reason || busy} onClick={submitReport}>
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={(o) => !busy && setBlockOpen(o)}>
        <DialogContent className="sm:max-w-md font-serif">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">
              {isBlocked ? `Unblock ${who}?` : `Block ${who}?`}
            </DialogTitle>
            <DialogDescription className="font-serif">
              {isBlocked
                ? 'Their artworks, profile and exhibitions will appear for you again.'
                : 'You won’t see their artworks, profile or exhibitions, and any follows between you are removed. They aren’t notified. You can unblock them in Settings → Privacy.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={busy} onClick={() => setBlockOpen(false)}>
              Cancel
            </Button>
            <Button
              className={isBlocked ? 'bg-wine text-parchment hover:bg-wine/90' : 'bg-red-700 text-white hover:bg-red-800'}
              disabled={busy}
              onClick={toggleBlock}
            >
              {isBlocked ? 'Unblock' : 'Block'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Shown in place of a blocked user's content on detail pages. */
export function BlockedContentNotice({
  ownerId,
  ownerName,
}: {
  ownerId: string;
  ownerName?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const who = ownerName?.trim() || 'this user';

  async function handleUnblock() {
    setBusy(true);
    const result = await unblockUser(ownerId);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-24 text-center font-serif">
      <Ban className="mx-auto mb-4 h-8 w-8 text-ink/40" aria-hidden />
      <h1 className="font-display text-2xl text-wine mb-2">You’ve blocked {who}</h1>
      <p className="text-ink/60 mb-6">Their content is hidden from you.</p>
      <div className="flex justify-center gap-3">
        <Button asChild variant="outline">
          <Link href="/artworks">Back to artworks</Link>
        </Button>
        <Button variant="ghost" disabled={busy} onClick={handleUnblock}>
          Unblock
        </Button>
      </div>
    </div>
  );
}
