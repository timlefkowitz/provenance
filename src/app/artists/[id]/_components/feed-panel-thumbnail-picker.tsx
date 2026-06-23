'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Check, Plus } from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import { setFeedPanelArtworks, clearFeedPanelArtworks } from '~/app/artworks/_actions/set-feed-panel-artworks';
import { FEED_PANEL_ARTWORK_MAX } from '~/lib/user-roles';

export type FeedPanelEligibleArtwork = {
  id: string;
  title: string;
  image_url: string | null;
  artist_name: string | null;
};

type Props = {
  /** user_profiles.id for this artist or gallery profile */
  profileId: string;
  mode: 'artist' | 'gallery';
  /** Verified, public artworks eligible to be featured */
  artworks: FeedPanelEligibleArtwork[];
  /** Currently selected artwork IDs (ordered) */
  initialSelectedIds: string[];
};

/**
 * Lets an artist or gallery owner pick up to FEED_PANEL_ARTWORK_MAX artworks
 * to show as the 3-photo preview in the artworks feed panel.
 */
export function FeedPanelThumbnailPicker({
  profileId,
  mode,
  artworks,
  initialSelectedIds,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setSelectedIds(initialSelectedIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedIds.join('|')]);

  if (artworks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-wine/20 bg-parchment/40 px-4 py-5 text-center">
        <p className="font-serif text-xs text-ink/55 leading-relaxed">
          {mode === 'artist'
            ? 'Once you have verified, public Certificates of Authenticity you can choose up to ' +
              FEED_PANEL_ARTWORK_MAX +
              ' to feature here.'
            : 'Once you have verified, public certificates under this gallery you can choose up to ' +
              FEED_PANEL_ARTWORK_MAX +
              ' to feature here.'}
        </p>
      </div>
    );
  }

  const handleToggle = async (artworkId: string) => {
    if (pending) return;

    const previous = selectedIds;
    const position = previous.indexOf(artworkId);
    let next: string[];

    if (position >= 0) {
      next = previous.filter((id) => id !== artworkId);
    } else if (previous.length >= FEED_PANEL_ARTWORK_MAX) {
      toast.error(
        `You can feature at most ${FEED_PANEL_ARTWORK_MAX} artworks. Remove one to add another.`,
      );
      return;
    } else {
      next = [...previous, artworkId];
    }

    setSelectedIds(next);
    setPending(true);
    try {
      const result =
        next.length === 0
          ? await clearFeedPanelArtworks({ profileId, mode })
          : await setFeedPanelArtworks({ profileId, artworkIds: next, mode });

      if (!result.success) {
        setSelectedIds(previous);
        toast.error(result.error || 'Could not update feed panel artworks.');
        return;
      }

      toast.success(
        next.length === 0
          ? 'Feed panel photos cleared.'
          : `Feed panel updated (${next.length}/${FEED_PANEL_ARTWORK_MAX}).`,
      );
    } catch (err) {
      console.error('[FeedPanelThumbnailPicker] update failed', err);
      setSelectedIds(previous);
      toast.error('Could not update feed panel photos. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="font-serif text-xs text-ink/55 leading-relaxed">
        Choose up to {FEED_PANEL_ARTWORK_MAX} artworks to show as the photos in the
        artworks feed panel. Tap to add or remove.
      </p>

      <div
        className="-mx-4 overflow-x-auto pb-2 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]"
        role="group"
        aria-label="Choose feed panel artworks"
      >
        <div className="flex gap-3 px-4 min-w-max">
          {artworks.map((artwork) => {
            const position = selectedIds.indexOf(artwork.id);
            const isSelected = position >= 0;

            return (
              <button
                key={artwork.id}
                type="button"
                disabled={pending}
                aria-pressed={isSelected}
                onClick={() => void handleToggle(artwork.id)}
                title={
                  isSelected
                    ? `${artwork.title} — #${position + 1} in feed panel (tap to remove)`
                    : `Add ${artwork.title} to feed panel`
                }
                className={cn(
                  'group relative flex-shrink-0 overflow-hidden rounded-lg border bg-wine/5 transition-all',
                  'h-24 w-24 sm:h-28 sm:w-28',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
                  isSelected
                    ? 'border-wine ring-2 ring-wine/40 shadow-md'
                    : 'border-wine/20 hover:border-wine/50 hover:shadow-sm',
                  pending && 'opacity-60 cursor-wait',
                )}
              >
                {artwork.image_url ? (
                  <Image
                    src={artwork.image_url}
                    alt={artwork.title}
                    fill
                    sizes="112px"
                    unoptimized
                    className={cn(
                      'object-cover transition-transform duration-300',
                      !isSelected && 'group-hover:scale-105',
                    )}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-wine/30 font-serif text-[10px]">
                    No image
                  </div>
                )}

                {isSelected ? (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-wine text-parchment px-1.5 py-0.5 text-[9px] font-serif tracking-wide shadow-sm">
                    <Check className="h-2.5 w-2.5" aria-hidden />#{position + 1}
                  </span>
                ) : (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-parchment/95 text-ink/70 px-1.5 py-0.5 text-[9px] font-serif tracking-wide opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                    <Plus className="h-2.5 w-2.5" aria-hidden />
                    Add
                  </span>
                )}

                <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent p-1.5 text-left">
                  <span className="block truncate font-serif text-[10px] text-parchment leading-tight">
                    {artwork.title}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
