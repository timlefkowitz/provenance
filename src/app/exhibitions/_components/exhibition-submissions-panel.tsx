'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Undo2, X } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import {
  reviewExhibitionSubmission,
  type ExhibitionSubmissionGroup,
} from '../_actions/review-exhibition-submissions';
import {
  countSubmissionsByStatus,
  type ExhibitionArtworkStatus,
  type ReviewDecision,
} from '../_helpers/exhibition-submission-status';
import { Eyebrow } from '~/components/editorial-form';

function statusLabel(status: ExhibitionArtworkStatus): string {
  switch (status) {
    case 'submitted':
      return 'Awaiting review';
    case 'selected':
      return 'Selected';
    case 'declined':
      return 'Declined';
  }
}

function statusClass(status: ExhibitionArtworkStatus): string {
  switch (status) {
    case 'submitted':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'selected':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'declined':
      return 'bg-cream/50 text-editorial-ink/50 border-ink/15';
  }
}

type ExhibitionSubmissionsPanelProps = {
  exhibitionId: string;
  initialGroups: ExhibitionSubmissionGroup[];
  issuesCertificateOfShow: boolean;
};

export function ExhibitionSubmissionsPanel({
  exhibitionId,
  initialGroups,
  issuesCertificateOfShow,
}: ExhibitionSubmissionsPanelProps) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Pick up new submissions after router.refresh().
  const [syncedGroups, setSyncedGroups] = useState(initialGroups);
  if (syncedGroups !== initialGroups) {
    setSyncedGroups(initialGroups);
    setGroups(initialGroups);
  }

  if (groups.length === 0) {
    return null;
  }

  const allCounts = countSubmissionsByStatus(
    groups.flatMap((g) => g.submissions.map((s) => s.status)),
  );

  const handleReview = (artworkId: string, decision: ReviewDecision) => {
    setBusyId(artworkId);
    startTransition(async () => {
      const result = await reviewExhibitionSubmission(exhibitionId, artworkId, decision);
      setBusyId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          submissions: g.submissions.map((s) =>
            s.artworkId === artworkId
              ? {
                  ...s,
                  status: result.status,
                  hasCos: s.hasCos || (decision === 'select' && issuesCertificateOfShow),
                }
              : s,
          ),
        })),
      );
      toast.success(decision === 'select' ? 'Added to the exhibition' : 'Submission declined');
      router.refresh();
    });
  };

  return (
    <section id="submissions" className="mt-12 pt-10 border-t border-editorial-border/20 scroll-mt-8">
      <div className="mb-6">
        <Eyebrow className="mb-3">Submissions</Eyebrow>
        <h2 className="font-fraunces text-2xl italic tracking-tight text-editorial-ink">Review submitted works</h2>
        <p className="text-editorial-ink/55 font-serif text-sm mt-2 max-w-2xl">
          Works artists submit stay private to you until you select them. Selected works join
          the exhibition
          {issuesCertificateOfShow ? ' and receive your Certificate of Show' : ''}; declined
          works stay with the artist.
        </p>
        <p className="font-serif text-xs text-editorial-ink/60 mt-3">
          {allCounts.submitted} awaiting review · {allCounts.selected} selected ·{' '}
          {allCounts.declined} declined
        </p>
      </div>

      <div className="space-y-6">
        {groups.map((group) => {
          const counts = countSubmissionsByStatus(group.submissions.map((s) => s.status));
          return (
            <div key={group.inviteId} className="border border-editorial-border/20 overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 bg-cream/40 border-b border-editorial-border/20">
                <div className="min-w-0">
                  <p className="font-serif text-sm text-editorial-ink font-semibold truncate">
                    {group.artistName}
                    {group.source === 'open_call' && (
                      <span className="ml-2 border border-editorial-border/30 px-1.5 py-px text-[10px] uppercase tracking-wide text-vermillion/80 font-normal">
                        Open call
                      </span>
                    )}
                  </p>
                  {group.artistEmail && group.artistEmail !== group.artistName && (
                    <p className="font-serif text-xs text-editorial-ink/50 truncate">{group.artistEmail}</p>
                  )}
                </div>
                <p className="font-serif text-xs text-editorial-ink/60">
                  {counts.selected} of {group.submissions.length} selected
                  {group.maxArtworks ? ` · limit ${group.maxArtworks}` : ''}
                </p>
              </div>

              <ul className="divide-y divide-editorial-border/15">
                {group.submissions.map((submission) => {
                  const busy = busyId === submission.artworkId;
                  const canDecline =
                    submission.status === 'submitted' ||
                    (submission.status === 'selected' && !submission.hasCos);
                  return (
                    <li
                      key={submission.artworkId}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-14 w-14 shrink-0 overflow-hidden border border-editorial-border/20 bg-cream/50">
                          {submission.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={submission.imageUrl}
                              alt={submission.title}
                              className={`h-full w-full object-cover ${submission.status === 'declined' ? 'opacity-50' : ''}`}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/artworks/${submission.artworkId}/certificate`}
                            className="font-serif text-sm text-editorial-ink hover:text-vermillion truncate block"
                          >
                            {submission.title}
                          </Link>
                          <p className="font-serif text-xs text-editorial-ink/50 truncate">
                            {[submission.medium, submission.creationDate?.slice(0, 4)]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span
                          className={`text-[11px] uppercase tracking-wide font-serif px-2 py-0.5 border ${statusClass(submission.status)}`}
                        >
                          {statusLabel(submission.status)}
                        </span>

                        {submission.status !== 'selected' && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => handleReview(submission.artworkId, 'select')}
                            className="gap-1 rounded-none bg-editorial-ink text-bone hover:bg-vermillion font-jetbrains text-[10px] uppercase tracking-[0.16em] h-8"
                          >
                            <Check className="h-3 w-3" />
                            Select
                          </Button>
                        )}

                        {submission.status === 'submitted' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => handleReview(submission.artworkId, 'decline')}
                            className="gap-1 font-serif text-xs h-8 text-editorial-ink/60 hover:text-vermillion"
                          >
                            <X className="h-3 w-3" />
                            Decline
                          </Button>
                        )}

                        {submission.status === 'selected' && canDecline && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => handleReview(submission.artworkId, 'decline')}
                            className="gap-1 font-serif text-xs h-8 text-editorial-ink/60 hover:text-vermillion"
                          >
                            <Undo2 className="h-3 w-3" />
                            Unselect
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
