import { headers } from 'next/headers';
import Image from 'next/image';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { hashShareToken } from '~/lib/share-links/tokens';
import { checkRateLimit } from '~/lib/rate-limit';

export const dynamic = 'force-dynamic';

type SharedArtwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
};

function Unavailable({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-parchment px-4">
      <div className="text-center max-w-sm">
        <p className="font-display text-xl text-ink mb-2">Link unavailable</p>
        <p className="font-serif text-sm text-ink/60">{message}</p>
      </div>
    </div>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const requestHeaders = await headers();
  const allowed = await checkRateLimit(
    { headers: requestHeaders },
    { keyPrefix: 'artwork-share-view', maxPerWindow: 30, windowMs: 60_000 },
  );
  if (!allowed) {
    return <Unavailable message="Too many requests. Please try again in a minute." />;
  }

  const tokenHash = hashShareToken(token);
  const adminClient = asUntyped(getSupabaseServerAdminClient());

  const { data: share } = await adminClient
    .from('artwork_shares')
    .select('id, tag_id, title, expires_at, revoked_at, view_count')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!share) {
    return <Unavailable message="This link doesn't exist or has already been removed." />;
  }
  if (share.revoked_at) {
    return <Unavailable message="This link has been revoked by its owner." />;
  }
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return <Unavailable message="This link has expired." />;
  }

  const { data: taggedRows } = await adminClient
    .from('artwork_tags')
    .select('artworks(id, title, artist_name, image_url, status, is_public, created_at)')
    .eq('tag_id', share.tag_id);

  type TaggedArtworkRow = SharedArtwork & { status: string; is_public: boolean; created_at: string };

  const artworks: SharedArtwork[] = (
    (taggedRows ?? []) as { artworks: TaggedArtworkRow | TaggedArtworkRow[] }[]
  )
    .flatMap((row) => (Array.isArray(row.artworks) ? row.artworks : [row.artworks]))
    .filter((a): a is TaggedArtworkRow => !!a && a.status === 'verified' && a.is_public)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  // Fire-and-forget view tracking; don't block the response on it.
  void adminClient
    .from('artwork_shares')
    .update({
      view_count: (share.view_count ?? 0) + 1,
      last_viewed_at: new Date().toISOString(),
    })
    .eq('id', share.id)
    .then(undefined, () => {});

  return (
    <div className="min-h-screen bg-parchment">
      <div className="container mx-auto max-w-5xl px-4 py-12">
        <p className="text-[11px] uppercase tracking-widest text-ink/40 font-serif mb-1">
          Shared works
        </p>
        <h1 className="font-display text-2xl text-ink mb-8">{share.title || 'A shared collection'}</h1>

        {artworks.length === 0 ? (
          <p className="font-serif text-sm text-ink/50">No works to show.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {artworks.map((artwork) => (
              <div key={artwork.id} className="group">
                <div className="relative aspect-square overflow-hidden bg-wine/5 rounded-lg">
                  {artwork.image_url ? (
                    <Image
                      src={artwork.image_url}
                      alt={artwork.title}
                      fill
                      className="object-cover"
                      unoptimized
                      loading="lazy"
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs text-ink/30 font-serif">No image</span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm font-serif text-ink truncate">{artwork.title}</p>
                {artwork.artist_name && (
                  <p className="text-xs font-serif text-ink/50 truncate">{artwork.artist_name}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-12 text-center text-[11px] font-serif text-ink/30">
          Shared privately via Provenance
        </p>
      </div>
    </div>
  );
}
