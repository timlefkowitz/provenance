'use client';

import { useState, useTransition, useEffect } from 'react';
import { Star } from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import {
  setRegistryArtwork,
  clearRegistryArtwork,
  toggleGalleryDirectoryCertificate,
} from '~/app/artworks/_actions/set-registry-artwork';
import { GALLERY_REGISTRY_THUMBNAIL_MAX } from '~/lib/user-roles';

type Props = {
  artworkId: string;
  mode: 'artist' | 'gallery';
  galleryProfileId?: string;
  isSelected: boolean;
  /** When mode is gallery, full current selection for add/remove semantics. */
  gallerySelectedIds?: string[];
  onSelectionChange?: (nextIds: string[]) => void;
};

/**
 * Star control for pinning registry / directory preview artwork(s).
 * Artist: at most one COA. Gallery: up to five COS / COO / COA (see user-roles).
 */
export function RegistryPhotoToggle({
  artworkId,
  mode,
  galleryProfileId,
  isSelected,
  gallerySelectedIds = [],
  onSelectionChange,
}: Props) {
  const [optimisticSelected, setOptimisticSelected] = useState(isSelected);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (mode === 'artist') {
      setOptimisticSelected(isSelected);
    }
  }, [isSelected, mode]);

  const displaySelected =
    mode === 'gallery' ? gallerySelectedIds.includes(artworkId) : optimisticSelected;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (pending) return;

    if (mode === 'gallery') {
      if (!galleryProfileId) return;
      const prev = gallerySelectedIds;
      const wasSelected = prev.includes(artworkId);
      if (!wasSelected && prev.length >= GALLERY_REGISTRY_THUMBNAIL_MAX) {
        toast.error(
          `You can pin at most ${GALLERY_REGISTRY_THUMBNAIL_MAX} directory certificates (clear one first).`,
        );
        return;
      }
      const nextIds = wasSelected ? prev.filter((id) => id !== artworkId) : [...prev, artworkId];

      startTransition(async () => {
        try {
          const result = await toggleGalleryDirectoryCertificate({
            galleryProfileId,
            artworkId,
          });
          if (!result.success) {
            toast.error(result.error || 'Could not update registry photo.');
            return;
          }
          toast.success(
            wasSelected ? 'Removed from directory gallery.' : 'Added to directory gallery.',
          );
          onSelectionChange?.(nextIds);
        } catch (err) {
          console.error('[RegistryPhotoToggle] gallery toggle failed', err);
          toast.error('Could not update registry photo. Please try again.');
        }
      });
      return;
    }

    const next = !optimisticSelected;
    setOptimisticSelected(next);

    startTransition(async () => {
      try {
        let result;
        if (next) {
          result = await setRegistryArtwork({ artworkId, mode, galleryProfileId });
        } else {
          result = await clearRegistryArtwork({ mode, galleryProfileId });
        }

        if (!result.success) {
          setOptimisticSelected(!next);
          toast.error(result.error || 'Could not update registry photo.');
          return;
        }

        toast.success(
          next ? 'Registry photo set. Your /registry listing will update shortly.' : 'Registry photo cleared.',
        );
        onSelectionChange?.(next ? [artworkId] : []);
      } catch (err) {
        setOptimisticSelected(!next);
        console.error('[RegistryPhotoToggle] action failed', err);
        toast.error('Could not update registry photo. Please try again.');
      }
    });
  };

  const starLabel =
    mode === 'gallery'
      ? displaySelected
        ? 'In directory gallery'
        : 'Add to directory gallery'
      : displaySelected
        ? 'Clear registry photo'
        : 'Set as registry photo';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={starLabel}
      aria-label={starLabel}
      className={cn(
        'absolute top-2 left-2 z-20 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-serif transition-all shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40',
        pending && 'opacity-60 cursor-wait',
        displaySelected
          ? 'bg-wine text-parchment border border-wine/80 hover:bg-wine/90'
          : 'bg-parchment/90 text-ink/60 border border-wine/25 hover:bg-wine/10 hover:text-wine hover:border-wine/50 opacity-0 group-hover:opacity-100',
      )}
    >
      <Star
        className={cn(
          'h-3 w-3 flex-shrink-0',
          displaySelected ? 'fill-parchment text-parchment' : 'fill-transparent',
        )}
        aria-hidden
      />
      <span className="leading-none whitespace-nowrap">
        {mode === 'gallery'
          ? displaySelected
            ? 'Directory'
            : 'Directory +'
          : displaySelected
            ? 'Registry photo'
            : 'Set as registry photo'}
      </span>
    </button>
  );
}
