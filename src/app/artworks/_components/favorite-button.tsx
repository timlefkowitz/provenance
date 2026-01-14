'use client';

import { useState, useEffect, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { addFavorite, removeFavorite, isFavorited } from '../_actions/favorites';

export function FavoriteButton({ 
  artworkId,
  currentUserId 
}: { 
  artworkId: string;
  currentUserId?: string;
}) {
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    // Check if artwork is favorited
    startTransition(async () => {
      try {
        const favoritedStatus = await isFavorited(artworkId);
        setFavorited(favoritedStatus);
      } catch (error) {
        console.error('Error checking favorite status:', error);
      } finally {
        setLoading(false);
      }
    });
  }, [artworkId, currentUserId]);

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
      } catch (error: any) {
        console.error('Error toggling favorite:', error);
        toast.error(error.message || 'Failed to update favorite');
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

