'use client';

import { useState } from 'react';
import { Card, CardContent } from '@kit/ui/card';
import {
  ExternalLink,
  Calendar,
  MapPin,
  DollarSign,
  Bookmark,
  X,
  Globe,
  ThumbsUp,
  Flag,
  ChevronDown,
  Share2,
  GalleryVerticalEnd,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from 'sonner';
import type { ArtistGrantRow } from '../_actions/get-artist-grants';
import { shareGrantToCommunity } from '../_actions/share-grant-to-community';
import { unshareGrant } from '../_actions/unshare-grant';
import { toggleGrantUpvote } from '../_actions/toggle-grant-upvote';
import { reportGrant } from '../_actions/report-grant';

type GrantsListProps = {
  grants: ArtistGrantRow[];
  onToggleBookmark?: (grantId: string, bookmarked: boolean) => void;
  onRemoveGrant?: (grantId: string) => void;
  onGrantChanged?: () => void;
};

function formatDeadline(d: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d;
  }
}

function typeLabel(type: string | null | undefined) {
  if (!type || type === 'grant') return null;
  if (type === 'open_call') return 'Open Call';
  if (type === 'residency') return 'Residency';
  return type;
}

function GrantCard({
  grant,
  onToggleBookmark,
  onRemoveGrant,
  onGrantChanged,
}: {
  grant: ArtistGrantRow;
  onToggleBookmark?: (grantId: string, bookmarked: boolean) => void;
  onRemoveGrant?: (grantId: string) => void;
  onGrantChanged?: () => void;
}) {
  const isUserOwned = grant.user_id !== null;
  const isBookmarked = grant.bookmarked === true;
  const isCommunity = grant.is_community === true;
  const [upvoted, setUpvoted] = useState(grant.viewer_has_upvoted);
  const [upvoteCount, setUpvoteCount] = useState(grant.upvote_count ?? 0);
  const [sharing, setSharing] = useState(false);
  const label = typeLabel(grant.type);
  const deadline = formatDeadline(grant.deadline);

  const daysUntilDeadline = grant.deadline
    ? Math.ceil((new Date(grant.deadline).getTime() - Date.now()) / 86_400_000)
    : null;
  const deadlineUrgent = daysUntilDeadline !== null && daysUntilDeadline <= 14;

  async function handleShare() {
    setSharing(true);
    const { success, error } = await shareGrantToCommunity(grant.id);
    setSharing(false);
    if (success) {
      toast.success('Shared with the community!');
      onGrantChanged?.();
    } else {
      toast.error(error || 'Failed to share');
    }
  }

  async function handleUnshare() {
    const { success, error } = await unshareGrant(grant.id);
    if (success) {
      toast.success('Removed from community');
      onGrantChanged?.();
    } else {
      toast.error(error || 'Failed to un-share');
    }
  }

  async function handleUpvote() {
    const prev = upvoted;
    const newUpvoted = !upvoted;
    setUpvoted(newUpvoted);
    setUpvoteCount((c) => (newUpvoted ? c + 1 : Math.max(0, c - 1)));

    const { success, error } = await toggleGrantUpvote(grant.id, prev);
    if (!success) {
      setUpvoted(prev);
      setUpvoteCount((c) => (prev ? c + 1 : Math.max(0, c - 1)));
      toast.error(error || 'Failed to update upvote');
    }
  }

  async function handleReport() {
    const reason = window.prompt(
      'Why are you reporting this grant? (e.g. spam, inaccurate, expired)',
    );
    if (!reason?.trim()) return;
    const { success, error } = await reportGrant(grant.id, reason.trim());
    if (success) {
      toast.success('Report submitted — thank you.');
    } else {
      toast.error(error || 'Failed to submit report');
    }
  }

  return (
    <Card className="group border-wine/15 bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
      <CardContent className="p-0">
        {/* Accent bar — type colour */}
        <div
          className={`h-1 w-full ${
            grant.type === 'residency'
              ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
              : grant.type === 'open_call'
                ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                : 'bg-gradient-to-r from-wine/60 to-wine'
          }`}
        />
        <div className="p-5">
          <div className="flex flex-col gap-3">
            {/* Title row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {label && (
                    <span
                      className={`text-[11px] font-sans font-semibold uppercase tracking-widest rounded-full px-2 py-0.5 ${
                        grant.type === 'residency'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {label}
                    </span>
                  )}
                  {isCommunity && (
                    <span className="flex items-center gap-1 text-[11px] font-sans font-medium text-wine/60 bg-wine/5 rounded-full px-2 py-0.5">
                      <Globe className="h-2.5 w-2.5" />
                      Community
                    </span>
                  )}
                </div>
                <h3 className="font-display font-bold text-wine text-lg leading-snug line-clamp-2">
                  {grant.name}
                </h3>
                {isCommunity && grant.shared_by_name && (
                  <p className="text-[11px] text-ink/40 font-serif mt-0.5">
                    Shared by {grant.shared_by_name}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Upvote — only on community grants */}
                {isCommunity && (
                  <button
                    onClick={handleUpvote}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-serif transition-all ${
                      upvoted
                        ? 'bg-wine/10 text-wine'
                        : 'text-ink/40 hover:text-wine hover:bg-wine/5'
                    }`}
                    aria-label={upvoted ? 'Remove upvote' : 'Upvote'}
                  >
                    <ThumbsUp
                      className={`h-3.5 w-3.5 transition-all ${upvoted ? 'fill-wine' : ''}`}
                    />
                    {upvoteCount > 0 && <span>{upvoteCount}</span>}
                  </button>
                )}

                {/* Bookmark — user-owned */}
                {isUserOwned && onToggleBookmark && (
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-ink/30 hover:text-wine hover:bg-wine/5 transition-all"
                    onClick={() => onToggleBookmark(grant.id, !isBookmarked)}
                    aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark grant'}
                  >
                    <Bookmark
                      className={`h-4 w-4 transition-colors ${
                        isBookmarked ? 'fill-wine text-wine' : ''
                      }`}
                    />
                  </button>
                )}

                {/* External link */}
                {grant.url && (
                  <a
                    href={grant.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-ink/30 hover:text-wine hover:bg-wine/5 transition-all"
                    aria-label="Visit grant website"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}

                {/* Overflow menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-8 w-8 flex items-center justify-center rounded-lg text-ink/30 hover:text-ink hover:bg-wine/5 transition-all">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="font-serif text-sm">
                    {/* Share / un-share (only for owner) */}
                    {isUserOwned && !isCommunity && (
                      <DropdownMenuItem
                        onClick={handleShare}
                        disabled={sharing}
                        className="gap-2 cursor-pointer"
                      >
                        <Share2 className="h-3.5 w-3.5 text-wine/70" />
                        Share with everyone
                      </DropdownMenuItem>
                    )}
                    {isUserOwned && isCommunity && (
                      <DropdownMenuItem onClick={handleUnshare} className="gap-2 cursor-pointer">
                        <Globe className="h-3.5 w-3.5 text-wine/70" />
                        Remove from community
                      </DropdownMenuItem>
                    )}
                    {/* Remove (owner only, non-curated) */}
                    {isUserOwned && onRemoveGrant && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onRemoveGrant(grant.id)}
                          className="gap-2 text-red-600 focus:text-red-600 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                          Remove grant
                        </DropdownMenuItem>
                      </>
                    )}
                    {/* Report — for community grants you don't own */}
                    {isCommunity && !isUserOwned && (
                      <DropdownMenuItem onClick={handleReport} className="gap-2 cursor-pointer">
                        <Flag className="h-3.5 w-3.5 text-ink/50" />
                        Report
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Description */}
            {grant.description && (
              <p className="font-serif text-sm text-ink/75 line-clamp-2 leading-relaxed">
                {grant.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-serif text-ink/55 pt-1 border-t border-wine/5">
              {deadline && (
                <span
                  className={`flex items-center gap-1 ${deadlineUrgent ? 'text-orange-600 font-semibold' : ''}`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {deadlineUrgent ? `${daysUntilDeadline}d left — ` : ''}
                  {deadline}
                </span>
              )}
              {grant.amount && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {grant.amount}
                </span>
              )}
              {(grant.eligible_locations?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {grant.eligible_locations.slice(0, 2).join(', ')}
                  {grant.eligible_locations.length > 2 ? ' +more' : ''}
                </span>
              )}
              {(grant.discipline?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <GalleryVerticalEnd className="h-3.5 w-3.5" />
                  {grant.discipline.slice(0, 2).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GrantsList({ grants, onToggleBookmark, onRemoveGrant, onGrantChanged }: GrantsListProps) {
  if (grants.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink/50 font-serif text-sm">
          No grants match your filters.
        </p>
        <p className="text-ink/35 font-serif text-xs mt-1">
          Try adjusting your search or ask Taco for personalised suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grants.map((grant) => (
        <GrantCard
          key={grant.id}
          grant={grant}
          onToggleBookmark={onToggleBookmark}
          onRemoveGrant={onRemoveGrant}
          onGrantChanged={onGrantChanged}
        />
      ))}
    </div>
  );
}
