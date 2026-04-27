'use client';

import { useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import { setRegistryArtwork, clearRegistryArtwork } from '~/app/artworks/_actions/set-registry-artwork';

type Props = {
  artworkId: string;
  mode: 'artist' | 'gallery';
  galleryProfileId?: string;
  isSelected: boolean;
  /** Callback fired after a successful toggle so the parent can re-render */
  onToggled?: (artworkId: string | null) => void;
};

/**
 * Star button overlaid on an artwork thumbnail in Collection Management.
 *
 * When selected: wine star → clicking clears the registry photo.
 * When unselected: ghost star → clicking sets this artwork as the registry photo.
 *
 * Only rendered for COA artworks where the user has the right mode/profile.
 */
export function RegistryPhotoToggle({
  artworkId,
  mode,
  galleryProfileId,
  isSelected,
  onToggled,
}: Props) {
  const [optimisticSelected, setOptimisticSelected] = useState(isSelected);
  const [pending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (pending) return;

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
        onToggled?.(next ? artworkId : null);
      } catch (err) {
        setOptimisticSelected(!next);
        console.error('[RegistryPhotoToggle] action failed', err);
        toast.error('Could not update registry photo. Please try again.');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={optimisticSelected ? 'Clear registry photo' : 'Set as registry photo'}
      aria-label={optimisticSelected ? 'Clear registry photo' : 'Set as registry photo'}
      className={cn(
        'absolute top-2 left-2 z-20 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-serif transition-all shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40',
        pending && 'opacity-60 cursor-wait',
        optimisticSelected
          ? 'bg-wine text-parchment border border-wine/80 hover:bg-wine/90'
          : 'bg-parchment/90 text-ink/60 border border-wine/25 hover:bg-wine/10 hover:text-wine hover:border-wine/50 opacity-0 group-hover:opacity-100',
      )}
    >
      <Star
        className={cn(
          'h-3 w-3 flex-shrink-0',
          optimisticSelected ? 'fill-parchment text-parchment' : 'fill-transparent',
        )}
        aria-hidden
      />
      <span className="leading-none whitespace-nowrap">
        {optimisticSelected ? 'Registry photo' : 'Set as registry photo'}
      </span>
    </button>
  );
}
