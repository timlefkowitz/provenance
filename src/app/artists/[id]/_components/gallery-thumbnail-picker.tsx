'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Star, Check } from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import {
  setRegistryArtwork,
  clearRegistryArtwork,
} from '~/app/artworks/_actions/set-registry-artwork';

export type EligibleThumbnailArtwork = {
  id: string;
  title: string;
  image_url: string | null;
  artist_name: string | null;
};

type Props = {
  /** The gallery's user_profiles.id (NOT the account id). */
  galleryProfileId: string;
  /** Verified, public COS / COO / COA artworks tied to this gallery profile. */
  artworks: EligibleThumbnailArtwork[];
  /** Currently selected registry_artwork_id, or null if none. */
  initialSelectedId: string | null;
};

/**
 * Inline thumbnail picker for a gallery owner viewing their own /artists/[id]
 * profile (when role=gallery). Lets them choose which Certificate of Show,
 * Ownership, or Authenticity is featured as the gallery's image on /registry,
 * without leaving the profile page.
 *
 * Uses the same server actions as the Collection Management star toggle so
 * state stays in sync across surfaces.
 */
export function GalleryThumbnailPicker({
  galleryProfileId,
  artworks,
  initialSelectedId,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (artworks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-wine/20 bg-parchment/40 px-4 py-5 text-center">
        <p className="font-serif text-xs text-ink/55 leading-relaxed">
          Once you publish a verified, public Certificate of Show,
          Ownership, or Authenticity under this gallery, you&apos;ll be able to
          pick it here as your directory thumbnail on /registry.
        </p>
      </div>
    );
  }

  const handleSelect = (artworkId: string) => {
    if (pendingId) return;

    const isAlreadySelected = selectedId === artworkId;
    const previousSelected = selectedId;
    const nextSelected = isAlreadySelected ? null : artworkId;

    setSelectedId(nextSelected);
    setPendingId(artworkId);

    startTransition(async () => {
      try {
        const result = isAlreadySelected
          ? await clearRegistryArtwork({ mode: 'gallery', galleryProfileId })
          : await setRegistryArtwork({
              artworkId,
              mode: 'gallery',
              galleryProfileId,
            });

        if (!result.success) {
          setSelectedId(previousSelected);
          toast.error(result.error || 'Could not update thumbnail.');
          return;
        }

        toast.success(
          isAlreadySelected
            ? 'Directory thumbnail cleared.'
            : 'Directory thumbnail updated. Your /registry listing will refresh shortly.',
        );
      } catch (err) {
        console.error('[GalleryThumbnailPicker] update failed', err);
        setSelectedId(previousSelected);
        toast.error('Could not update thumbnail. Please try again.');
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      <p className="font-serif text-xs text-ink/55 leading-relaxed">
        Pick which certificate represents your gallery on the public registry
        (/registry): Show, Ownership, or Authenticity. Tap a thumbnail to make it
        the cover image.
      </p>

      {/* Horizontal scroller — Apple-style edge-to-edge thumbnail rail */}
      <div
        className="-mx-4 overflow-x-auto pb-2 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]"
        role="radiogroup"
        aria-label="Choose gallery directory thumbnail"
      >
        <div className="flex gap-3 px-4 min-w-max">
          {artworks.map((artwork) => {
            const isSelected = selectedId === artwork.id;
            const isPending = pendingId === artwork.id;

            return (
              <button
                key={artwork.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={isPending}
                onClick={() => handleSelect(artwork.id)}
                title={
                  isSelected
                    ? `${artwork.title} — current directory thumbnail`
                    : `Set ${artwork.title} as directory thumbnail`
                }
                className={cn(
                  'group relative flex-shrink-0 overflow-hidden rounded-lg border bg-wine/5 transition-all',
                  'h-24 w-24 sm:h-28 sm:w-28',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
                  isSelected
                    ? 'border-wine ring-2 ring-wine/40 shadow-md'
                    : 'border-wine/20 hover:border-wine/50 hover:shadow-sm',
                  isPending && 'opacity-60 cursor-wait',
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

                {/* Selected state — wine pill with check */}
                {isSelected && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-wine text-parchment px-1.5 py-0.5 text-[9px] font-serif tracking-wide shadow-sm">
                    <Check className="h-2.5 w-2.5" aria-hidden />
                    Cover
                  </span>
                )}

                {/* Hover hint for unselected — only on devices that hover */}
                {!isSelected && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-parchment/95 text-ink/70 px-1.5 py-0.5 text-[9px] font-serif tracking-wide opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                    <Star className="h-2.5 w-2.5" aria-hidden />
                    Set cover
                  </span>
                )}

                {/* Title gradient at bottom for context */}
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
