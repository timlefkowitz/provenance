'use client';

import { useState, useTransition } from 'react';
import { featureArtwork } from '../_actions/feature-artwork';

interface FeatureButtonProps {
  artworkId: string;
  featured: boolean;
  artworkTitle: string;
}

export function FeatureButton({ artworkId, featured, artworkTitle }: FeatureButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [currentFeatured, setCurrentFeatured] = useState(featured);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const action = currentFeatured ? 'remove from featured' : 'feature on homepage';
    if (!confirm(`${action === 'feature on homepage' ? 'Feature' : 'Un-feature'} "${artworkTitle}"?\n\n${action === 'feature on homepage' ? 'A congratulations email will be sent to the artist.' : 'The artwork will be removed from the homepage queue.'}`)) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await featureArtwork(artworkId);
      if (result.error) {
        setError(result.error);
      } else {
        setCurrentFeatured((prev) => !prev);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className={[
          'px-4 py-1.5 text-xs font-display tracking-wider uppercase transition-all border',
          currentFeatured
            ? 'bg-wine text-parchment border-wine hover:bg-wine/80'
            : 'bg-transparent text-wine border-wine hover:bg-wine/10',
          isPending && 'opacity-50 cursor-not-allowed',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isPending
          ? 'Saving…'
          : currentFeatured
          ? '★ Featured'
          : '☆ Feature'}
      </button>
      {error && (
        <p className="text-red-600 text-xs font-sans">{error}</p>
      )}
    </div>
  );
}
