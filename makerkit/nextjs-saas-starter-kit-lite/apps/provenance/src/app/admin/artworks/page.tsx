import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import Image from 'next/image';
import { FeatureButton } from './_components/feature-button';

export const metadata = { title: 'Admin – Artworks | Provenance' };

interface Artwork {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  featured: boolean;
  featured_at: string | null;
  created_at: string;
  accounts: { email: string | null } | null;
}

export default async function AdminArtworksPage() {
  const admin = getSupabaseServerAdminClient();

  const { data: artworks, error } = await (admin as any)
    .from('artworks')
    .select(`
      id,
      title,
      artist_name,
      image_url,
      featured,
      featured_at,
      created_at,
      accounts(email)
    `)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[Admin/artworks] Failed to load artworks:', error);
  }

  const rows: Artwork[] = artworks ?? [];
  const featuredCount = rows.filter((a) => a.featured).length;

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-widest text-wine uppercase mb-1">
          Artworks
        </h1>
        <p className="text-ink/60 text-sm font-sans">
          {rows.length} total &middot; {featuredCount} currently featured on the homepage
        </p>
      </div>

      {/* Info callout */}
      <div className="mb-8 p-4 border border-wine/30 bg-wine/5 text-sm text-ink/80 font-sans leading-relaxed">
        <strong className="font-semibold">How featuring works:</strong> Clicking&nbsp;
        <em>Feature</em> queues the artwork to appear on the Provenance landing page and
        automatically sends a congratulations email to the artist. Click again to remove it
        from the queue.
      </div>

      {rows.length === 0 ? (
        <p className="text-ink/50 font-sans">No artworks found.</p>
      ) : (
        <div className="divide-y divide-wine/10 border-y border-wine/10">
          {rows.map((artwork) => (
            <div
              key={artwork.id}
              className={[
                'flex items-center gap-5 py-4',
                artwork.featured && 'bg-wine/5',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 flex-shrink-0 bg-stone-200 border border-wine/20 overflow-hidden">
                {artwork.image_url ? (
                  <Image
                    src={artwork.image_url}
                    alt={artwork.title}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink/30 text-xs font-sans">
                    No img
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-display text-base text-ink truncate">{artwork.title}</p>
                <p className="text-sm text-ink/60 font-sans">
                  {artwork.artist_name ?? '—'}{' '}
                  {artwork.accounts?.email && (
                    <span className="text-ink/40">&lt;{artwork.accounts.email}&gt;</span>
                  )}
                </p>
                {artwork.featured && artwork.featured_at && (
                  <p className="text-xs text-wine/80 font-sans mt-0.5">
                    Featured{' '}
                    {new Date(artwork.featured_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>

              {/* Feature toggle */}
              <FeatureButton
                artworkId={artwork.id}
                featured={artwork.featured}
                artworkTitle={artwork.title}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
