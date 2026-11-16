'use client';

import { useState, useTransition } from 'react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { ArtworkCard, type ArtworkCardArtwork } from '~/app/artworks/_components/artwork-card';
import { loadGalleryWorks } from '../_actions/load-gallery-works';

/** A gallery's Certificates of Show grid that pages in more works on demand. */
export function GalleryWorksGrid({
  galleryProfileId,
  initialArtworks,
  total,
  currentUserId,
}: {
  galleryProfileId: string;
  initialArtworks: ArtworkCardArtwork[];
  total: number;
  currentUserId?: string;
}) {
  const [artworks, setArtworks] = useState(initialArtworks);
  const [exhausted, setExhausted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const remaining = Math.max(0, total - artworks.length);

  const loadMore = () => {
    startTransition(async () => {
      const result = await loadGalleryWorks(galleryProfileId, artworks.length);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.artworks.length === 0) {
        setExhausted(true);
        return;
      }
      setArtworks((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...result.artworks.filter((a) => !seen.has(a.id))];
      });
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
        {artworks.map((artwork) => (
          <ArtworkCard
            key={artwork.id}
            artwork={artwork}
            currentUserId={currentUserId}
            imageFit="contain"
          />
        ))}
      </div>
      {remaining > 0 && !exhausted && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={loadMore}
            disabled={isPending}
            className="font-serif border-wine/30 hover:bg-wine/10"
          >
            {isPending ? 'Loading…' : 'See more'}
          </Button>
          <p className="text-xs text-ink/45 font-serif">
            Showing {artworks.length} of {total}
          </p>
        </div>
      )}
    </>
  );
}
