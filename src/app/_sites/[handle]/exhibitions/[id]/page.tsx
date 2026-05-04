import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSiteData } from '../../_data/get-site-data';

export const dynamic = 'force-dynamic';

export default async function SiteExhibitionPage({
  params,
}: {
  params: Promise<{ handle: string; id: string }>;
}) {
  const { handle, id } = await params;

  const [site, exhibition] = await Promise.all([
    getSiteData(handle),
    fetchExhibition(id),
  ]);

  if (!site || !site.published_at || !exhibition) {
    notFound();
  }

  const accentColor = resolveAccent(site.theme.accent);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111', background: '#fff', minHeight: '100svh' }}>
      <div className="max-w-4xl mx-auto px-6 pt-8">
        <Link
          href="/"
          className="text-xs uppercase tracking-widest transition-opacity hover:opacity-60"
          style={{ color: accentColor }}
        >
          ← {site.name}
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero image */}
        {exhibition.image_url && (
          <div className="relative aspect-video overflow-hidden mb-10 bg-gray-50">
            <Image
              src={exhibition.image_url}
              alt={exhibition.title}
              fill
              className="object-cover"
              unoptimized
              priority
            />
          </div>
        )}

        {/* Title block */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold leading-snug mb-3" style={{ color: '#111' }}>
            {exhibition.title}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: '#888' }}>
            <span>
              {new Date(exhibition.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              {exhibition.end_date && (
                <> – {new Date(exhibition.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</>
              )}
            </span>
            {exhibition.location && <span>{exhibition.location}</span>}
          </div>
        </div>

        {/* Description */}
        {exhibition.description && (
          <p className="text-base leading-relaxed mb-12 max-w-2xl" style={{ color: '#444' }}>
            {exhibition.description}
          </p>
        )}

        {/* Artworks in exhibition */}
        {exhibition.artworks.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest mb-6" style={{ color: accentColor }}>
              Works
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {exhibition.artworks.map((artwork) => (
                <div key={artwork.id}>
                  <div className="relative aspect-square overflow-hidden bg-gray-50 mb-2">
                    {artwork.image_url ? (
                      <Image
                        src={artwork.image_url}
                        alt={artwork.title}
                        fill
                        className="object-cover"
                        unoptimized
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs text-gray-400">No image</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium" style={{ color: '#111' }}>{artwork.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

async function fetchExhibition(exhibitionId: string) {
  const client = getSupabaseServerClient();
  const sb = client as any;

  const { data: ex, error } = await sb
    .from('exhibitions')
    .select('id, title, description, start_date, end_date, location, image_url')
    .eq('id', exhibitionId)
    .maybeSingle();

  if (error || !ex) return null;

  const { data: artworkLinks } = await sb
    .from('exhibition_artworks')
    .select(`
      artworks!exhibition_artworks_artwork_id_fkey (
        id, title, image_url
      )
    `)
    .eq('exhibition_id', exhibitionId)
    .limit(24);

  const artworks = (artworkLinks ?? [])
    .map((r: any) => r.artworks)
    .filter(Boolean);

  return { ...ex, artworks };
}

function resolveAccent(key: string): string {
  const map: Record<string, string> = {
    wine: '#4A2F25', slate: '#3D4B5C', forest: '#2D4A3E',
    sand: '#8B7355', midnight: '#1A1A2E', rose: '#8B4558',
  };
  return map[key] ?? '#4A2F25';
}
