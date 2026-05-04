import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSiteData } from '../../_data/get-site-data';

export const dynamic = 'force-dynamic';

export default async function SiteArtworkPage({
  params,
}: {
  params: Promise<{ handle: string; artworkId: string }>;
}) {
  const { handle, artworkId } = await params;

  const [site, artworkData] = await Promise.all([
    getSiteData(handle),
    fetchArtwork(artworkId),
  ]);

  if (!site || !site.published_at || !artworkData) {
    notFound();
  }

  const accentColor = resolveAccent(site.theme.accent);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111', background: '#fff', minHeight: '100svh' }}>
      {/* Back link */}
      <div className="max-w-4xl mx-auto px-6 pt-8">
        <Link
          href="/"
          className="text-xs uppercase tracking-widest transition-opacity hover:opacity-60"
          style={{ color: accentColor }}
        >
          ← {site.name}
        </Link>
      </div>

      {/* Artwork detail */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Image */}
          <div className="relative aspect-square bg-gray-50 overflow-hidden">
            {artworkData.image_url ? (
              <Image
                src={artworkData.image_url}
                alt={artworkData.title}
                fill
                className="object-contain"
                unoptimized
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-xs text-gray-400">No image</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold leading-snug" style={{ color: '#111' }}>
                {artworkData.title}
              </h1>
              {artworkData.artist_name && (
                <p className="text-sm mt-1" style={{ color: '#666' }}>
                  {artworkData.artist_name}
                </p>
              )}
            </div>

            {artworkData.dimensions && (
              <div>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#aaa' }}>
                  Dimensions
                </p>
                <p className="text-sm" style={{ color: '#444' }}>{artworkData.dimensions}</p>
              </div>
            )}

            {artworkData.description && (
              <div>
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#aaa' }}>
                  About this work
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#444' }}>
                  {artworkData.description}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#aaa' }}>
                Added
              </p>
              <p className="text-sm" style={{ color: '#444' }}>
                {new Date(artworkData.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function fetchArtwork(artworkId: string) {
  const client = getSupabaseServerClient();
  const { data } = await (client as any)
    .from('artworks')
    .select('id, title, artist_name, image_url, description, dimensions, created_at')
    .eq('id', artworkId)
    .eq('status', 'verified')
    .eq('is_public', true)
    .maybeSingle();
  return data ?? null;
}

function resolveAccent(key: string): string {
  const map: Record<string, string> = {
    wine: '#4A2F25', slate: '#3D4B5C', forest: '#2D4A3E',
    sand: '#8B7355', midnight: '#1A1A2E', rose: '#8B4558',
  };
  return map[key] ?? '#4A2F25';
}
