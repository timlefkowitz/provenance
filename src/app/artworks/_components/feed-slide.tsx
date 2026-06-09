'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FavoriteButton } from './favorite-button';
import { ArtistPanel, type FeedArtwork } from './artist-panel';

export function FeedSlide({
  artwork,
  currentUserId,
  priority,
}: {
  artwork: FeedArtwork;
  currentUserId?: string;
  priority?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [artistRevealed, setArtistRevealed] = useState(false);
  const [onArtistPanel, setOnArtistPanel] = useState(false);

  const handleTrackScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const scrolled = track.scrollLeft > track.clientWidth * 0.25;
    if (scrolled && !artistRevealed) {
      setArtistRevealed(true);
    }
    setOnArtistPanel(scrolled);
  }, [artistRevealed]);

  const scrollToArtwork = () => {
    trackRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const scrollToArtist = () => {
    const track = trackRef.current;
    if (!track) return;
    setArtistRevealed(true);
    track.scrollTo({ left: track.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="h-[calc(100dvh-var(--nav-h))] w-full snap-start shrink-0">
      <div
        ref={trackRef}
        onScroll={handleTrackScroll}
        className="flex h-full w-full overflow-x-auto snap-x snap-mandatory overscroll-x-contain scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Artwork panel */}
        <div className="relative h-full w-full shrink-0 snap-start bg-parchment">
          <Link
            href={`/artworks/${artwork.id}/certificate`}
            className="relative block h-full w-full"
          >
            {artwork.image_url ? (
              <Image
                src={artwork.image_url}
                alt={artwork.title}
                fill
                priority={priority}
                className="object-contain"
                sizes="100vw"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-ink/20 font-serif text-sm">No image</span>
              </div>
            )}
          </Link>

          {/* Favorite — top right on artwork, below floating search */}
          <div className="absolute top-14 right-4 z-10">
            <FavoriteButton
              artworkId={artwork.id}
              currentUserId={currentUserId}
              variant="overlay"
              showWhenSignedOut
            />
          </div>

          {/* Bottom overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-16 bg-gradient-to-t from-parchment/90 via-parchment/40 to-transparent pointer-events-none">
            <div className="min-w-0 pointer-events-none">
              <p className="font-display text-sm text-wine truncate">{artwork.title}</p>
              {artwork.artist_name && (
                <p className="text-xs text-ink/60 font-serif truncate">
                  {artwork.artist_name}
                  {artwork.medium && (
                    <span className="text-ink/40"> · {artwork.medium}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Desktop chevron — swipe right hint */}
          <button
            type="button"
            onClick={scrollToArtist}
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-parchment/60 text-wine/60 hover:text-wine hover:bg-parchment/80 transition-colors"
            aria-label="View artist"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Artist panel */}
        <div className="relative h-full w-full shrink-0 snap-start">
          <ArtistPanel artwork={artwork} revealed={artistRevealed} />

          {/* Desktop chevron — back to artwork */}
          {onArtistPanel && (
            <button
              type="button"
              onClick={scrollToArtwork}
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-parchment/60 text-wine/60 hover:text-wine hover:bg-parchment/80 transition-colors"
              aria-label="Back to artwork"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
