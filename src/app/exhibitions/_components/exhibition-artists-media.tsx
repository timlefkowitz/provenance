import Link from 'next/link';
import { Image as ImageIcon, User } from 'lucide-react';
import type { ExhibitionWithDetails } from '../_actions/get-exhibitions';

function initials(name: string): string {
  if (!name.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function ExhibitionArtistsMedia({
  exhibition,
}: {
  exhibition: ExhibitionWithDetails;
}) {
  const { artists, artworks } = exhibition;

  const workCountByArtist = (name: string) => {
    const target = name.trim().toLowerCase();
    if (!target) return 0;
    return artworks.filter(
      (a) => (a.artist_name ?? '').trim().toLowerCase() === target,
    ).length;
  };

  // Artists credited via artworks but not in the explicit artists list.
  const creditedNames = new Set(artists.map((a) => a.name.trim().toLowerCase()));
  const extraArtistNames = Array.from(
    new Set(
      artworks
        .map((a) => (a.artist_name ?? '').trim())
        .filter((n) => n.length > 0 && !creditedNames.has(n.toLowerCase())),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const hasArtists = artists.length > 0 || extraArtistNames.length > 0;

  if (!hasArtists && artworks.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed border-wine/15 rounded-2xl">
        <p className="text-[10px] uppercase tracking-widest text-ink/25 font-serif mb-3">
          Nothing Listed Yet
        </p>
        <p className="text-ink/35 font-serif text-sm">
          Artists and works will appear here once added.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* ── ARTISTS ─────────────────────────────────────────────── */}
      {hasArtists && (
        <section>
          <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-5">
            Artists · {artists.length + extraArtistNames.length}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {artists.map((artist) => {
              const count = workCountByArtist(artist.name);
              return (
                <Link
                  key={artist.id}
                  href={`/artists/${artist.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-wine/12 bg-parchment/40 p-3 hover:border-wine/30 hover:bg-parchment/70 transition-colors"
                >
                  {artist.picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={artist.picture_url}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wine/12 text-xs font-serif font-semibold text-wine shrink-0">
                      {initials(artist.name)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-serif text-sm text-ink/80 leading-tight truncate group-hover:text-wine transition-colors">
                      {artist.name}
                    </p>
                    {count > 0 && (
                      <p className="font-serif text-[11px] text-ink/40 leading-tight mt-0.5">
                        {count} work{count === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}

            {extraArtistNames.map((name) => {
              const count = workCountByArtist(name);
              return (
                <div
                  key={`extra-${name}`}
                  className="flex items-center gap-3 rounded-xl border border-wine/12 bg-parchment/40 p-3"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wine/12 text-xs font-serif font-semibold text-wine shrink-0">
                    {initials(name)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif text-sm text-ink/80 leading-tight truncate">
                      {name}
                    </p>
                    {count > 0 && (
                      <p className="font-serif text-[11px] text-ink/40 leading-tight mt-0.5">
                        {count} work{count === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── MEDIA ───────────────────────────────────────────────── */}
      {artworks.length > 0 && (
        <section>
          <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-5">
            Media · {artworks.length}
          </p>
          <div className="divide-y divide-wine/10 rounded-xl border border-wine/12 overflow-hidden">
            {artworks.map((artwork) => (
              <Link
                key={artwork.id}
                href={`/artworks/${artwork.id}/certificate`}
                className="group flex items-center gap-4 bg-parchment/30 px-3 py-3 hover:bg-wine/[0.04] transition-colors"
              >
                {artwork.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artwork.image_url}
                    alt=""
                    className="h-14 w-14 rounded-md object-cover shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-md bg-wine/8 shrink-0">
                    <ImageIcon className="h-5 w-5 text-wine/25" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-sm font-semibold text-ink leading-snug truncate group-hover:text-wine transition-colors">
                    {artwork.title || 'Untitled'}
                  </p>
                  {artwork.artist_name?.trim() && (
                    <p className="font-serif text-xs text-ink/55 leading-snug truncate mt-0.5 flex items-center gap-1">
                      <User className="h-3 w-3 text-wine/35" />
                      {artwork.artist_name.trim()}
                    </p>
                  )}
                  {(artwork.dimensions || artwork.listPriceDisplay) && (
                    <p className="font-serif text-[11px] text-ink/40 leading-snug mt-0.5">
                      {[artwork.listPriceDisplay, artwork.dimensions]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
