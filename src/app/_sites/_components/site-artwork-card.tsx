import Image from 'next/image';
import Link from 'next/link';
import type { SiteArtwork } from '../types';

export function SiteArtworkCard({
  artwork,
  handle,
  accentColor,
}: {
  artwork: SiteArtwork;
  handle: string;
  accentColor?: string;
}) {
  const accent = accentColor ?? 'var(--site-accent)';

  return (
    <Link
      href={`/works/${artwork.id}`}
      className="group block overflow-hidden"
      style={{ '--card-accent': accent } as React.CSSProperties}
    >
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        {artwork.image_url ? (
          <Image
            src={artwork.image_url}
            alt={artwork.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
            loading="lazy"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xs text-gray-400" style={{ fontFamily: 'system-ui, sans-serif' }}>
              No image
            </span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3
          className="text-sm font-medium leading-snug transition-colors"
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#111111',
          }}
        >
          {artwork.title}
        </h3>
        {artwork.artist_name && (
          <p
            className="text-xs mt-0.5"
            style={{ color: '#666', fontFamily: 'system-ui, sans-serif' }}
          >
            {artwork.artist_name}
          </p>
        )}
        <p
          className="text-xs mt-1"
          style={{ color: '#999', fontFamily: 'system-ui, sans-serif' }}
        >
          {new Date(artwork.created_at).getFullYear()}
        </p>
      </div>
    </Link>
  );
}
