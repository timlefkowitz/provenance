'use client';

import { useState, useEffect, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { addFavorite, removeFavorite, isFavorited } from '../_actions/favorites';
import { isStaleServerActionError } from '~/lib/stale-server-action';

export function FavoriteButton({
  artworkId,
  currentUserId,
  /** When set (e.g. server-batched portal data), skip per-card isFavorited() on mount */
  initialFavorited,
}: {
  artworkId: string;
  currentUserId?: string;
  initialFavorited?: boolean;
}) {
  const [favorited, setFavorited] = useState(() =>
    initialFavorited !== undefined ? initialFavorited : false,
  );
  const [loading, setLoading] = useState(initialFavorited === undefined);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    if (initialFavorited !== undefined) {
      setFavorited(initialFavorited);
      setLoading(false);
      return;
    }

    startTransition(async () => {
      try {
        const favoritedStatus = await isFavorited(artworkId);
        setFavorited(favoritedStatus);
      } catch (error) {
        if (isStaleServerActionError(error)) {
          console.error(
            '[FavoriteButton] Server action missing — stale JS after deploy? Hard refresh / clear cache.',
            error,
          );
        } else {
          console.error('[FavoriteButton] Error checking favorite status', error);
        }
      } finally {
        setLoading(false);
      }
    });
  }, [artworkId, currentUserId, initialFavorited]);

  const handleToggle = () => {
    if (!currentUserId) {
      toast.error('Please sign in to favorite artworks');
      return;
    }

    if (pending) return;

    startTransition(async () => {
      try {
        if (favorited) {
          await removeFavorite(artworkId);
          setFavorited(false);
          toast.success('Removed from favorites');
        } else {
          await addFavorite(artworkId);
          setFavorited(true);
          toast.success('Added to favorites');
        }
      } catch (error: unknown) {
        if (isStaleServerActionError(error)) {
          console.error('[FavoriteButton] Toggle failed — stale deployment bundle', error);
          toast.error('Please refresh the page (Cmd/Ctrl+Shift+R) to sync with the site.');
        } else {
          const msg = error instanceof Error ? error.message : 'Failed to update favorite';
          console.error('[FavoriteButton] Error toggling favorite', error);
          toast.error(msg);
        }
      }
    });
  };

  if (!currentUserId) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-8 w-8 p-0 rounded-full transition-all ${
        favorited 
          ? 'text-wine hover:text-wine/80 bg-wine/10' 
          : 'text-ink/50 hover:text-wine hover:bg-wine/5'
      }`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleToggle();
      }}
      disabled={loading || pending}
      title={favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart 
        className={`h-4 w-4 ${favorited ? 'fill-current' : ''}`} 
      />
    </Button>
  );
}

