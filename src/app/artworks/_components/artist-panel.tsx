'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { TacoAvatar } from '~/components/taco-avatar';

export type FeedArtwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  medium: string | null;
  creation_date: string | null;
  account_id: string;
  artist_account_id: string | null;
  artist_profile_id: string | null;
};

type ArtistPreview = {
  name: string | null;
  picture_url: string | null;
  bio: string | null;
  medium: string | null;
  location: string | null;
  profileHref: string | null;
  recentWorks: { id: string; title: string; image_url: string | null }[];
};

export function ArtistPanel({
  artwork,
  revealed,
}: {
  artwork: FeedArtwork;
  revealed: boolean;
}) {
  const [preview, setPreview] = useState<ArtistPreview | null>(null);
  const [error, setError] = useState(false);
  const fetchStartedRef = useRef(false);

  const hasResolvableProfile =
    !!artwork.artist_account_id ||
    !!artwork.artist_profile_id ||
    !!artwork.account_id;

  const shouldFetch = revealed && hasResolvableProfile && !preview && !error;
  const loading = shouldFetch;

  useEffect(() => {
    if (!shouldFetch || fetchStartedRef.current) return;
    fetchStartedRef.current = true;

    const params = new URLSearchParams();
    if (artwork.artist_account_id) {
      params.set('accountId', artwork.artist_account_id);
    } else if (artwork.artist_profile_id) {
      params.set('profileId', artwork.artist_profile_id);
    } else if (artwork.account_id) {
      params.set('posterAccountId', artwork.account_id);
    }

    console.log('[ArtistPanel] Fetching artist preview');

    fetch(`/api/artist-preview?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load artist preview');
        return res.json() as Promise<ArtistPreview>;
      })
      .then((data) => {
        setPreview(data);
        console.log('[ArtistPanel] Artist preview loaded');
      })
      .catch((err) => {
        console.error('[ArtistPanel] Failed to load artist preview', err);
        setError(true);
      });
  }, [shouldFetch, artwork]);

  const displayName = preview?.name ?? artwork.artist_name ?? 'Unknown Artist';

  return (
    <div className="h-full w-full bg-parchment flex flex-col items-center justify-center px-8 py-12 overflow-y-auto">
      {loading && (
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-20 w-20 rounded-full bg-wine/10" />
          <div className="h-4 w-32 bg-wine/10 rounded" />
          <div className="h-3 w-48 bg-wine/10 rounded" />
        </div>
      )}

      {!loading && error && (
        <div className="text-center">
          <p className="font-display text-lg text-wine mb-1">{displayName}</p>
          <p className="text-sm text-ink/50 font-serif">Profile not available</p>
        </div>
      )}

      {!loading && !error && (preview || !hasResolvableProfile) && (
        <div className="max-w-sm w-full flex flex-col items-center text-center">
          <TacoAvatar
            pictureUrl={preview?.picture_url}
            displayName={displayName}
            className="h-20 w-20 rounded-full mb-4"
          />

          <h2 className="font-display text-xl text-wine mb-1">{displayName}</h2>

          {(preview?.medium || preview?.location) && (
            <p className="text-sm text-ink/60 font-serif mb-4">
              {[preview?.medium, preview?.location].filter(Boolean).join(' · ')}
            </p>
          )}

          {preview?.bio && (
            <p className="text-sm text-ink/70 font-serif leading-relaxed mb-6 line-clamp-4">
              {preview.bio}
            </p>
          )}

          {!hasResolvableProfile && (
            <p className="text-sm text-ink/50 font-serif mb-6">Profile not available</p>
          )}

          {preview?.recentWorks && preview.recentWorks.length > 0 && (
            <div className="flex gap-2 mb-6 w-full justify-center">
              {preview.recentWorks.map((work) => (
                <Link
                  key={work.id}
                  href={`/artworks/${work.id}/certificate`}
                  className="relative h-20 w-20 shrink-0 overflow-hidden bg-wine/5"
                >
                  {work.image_url ? (
                    <Image
                      src={work.image_url}
                      alt={work.title}
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <span className="text-xs text-ink/30 font-serif">—</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}

          {preview?.profileHref && (
            <Link
              href={preview.profileHref}
              className="text-sm font-serif text-wine hover:text-wine/70 transition-colors"
            >
              View profile →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
