import Link from 'next/link';
import Image from 'next/image';
import {
  ArtworkCard,
  type ArtworkCardArtwork,
} from '~/app/artworks/_components/artwork-card';
import { Calendar, MapPin, Newspaper } from 'lucide-react';
import { SocialLinkItem } from './social-link-item';

export type UnclaimedArtistProfileRow = {
  id: string;
  name: string;
  picture_url: string | null;
  bio: string | null;
  medium: string | null;
  location: string | null;
  website: string | null;
  links: string[] | null;
  galleries: string[] | null;
  news_publications?: { title: string; url: string; publication_name?: string; date?: string }[] | null;
};

export type ExhibitionSummary = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
};

export function UnclaimedArtistPublicView({
  profile,
  artworks,
  exhibitions,
  currentUserId,
}: {
  profile: UnclaimedArtistProfileRow;
  artworks: ArtworkCardArtwork[];
  exhibitions: ExhibitionSummary[];
  currentUserId?: string;
}) {
  const displayName = profile.name;
  const pictureUrl = profile.picture_url;
  const medium = profile.medium || '';
  const bio = profile.bio || '';
  const location = profile.location || '';
  const website = profile.website || '';
  const links = profile.links || [];
  const galleries = profile.galleries || [];
  const newsPublications = profile.news_publications || [];

  const hasSidebarContent =
    Boolean(bio) || galleries.length > 0 || newsPublications.length > 0;

  return (
    <div className="min-h-screen">
      {/* ── HERO HEADER ─────────────────────────────────────────── */}
      <div className="border-b border-wine/15">
        <div className="container mx-auto px-4 max-w-6xl py-10 md:py-14">
          <div className="flex flex-col sm:flex-row gap-7 sm:gap-10 items-start">

            {/* Avatar */}
            <div className="relative flex-shrink-0 w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border border-wine/20 bg-wine/5">
              {pictureUrl ? (
                <Image
                  src={pictureUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized
                  loading="eager"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-3xl md:text-4xl font-display font-bold text-wine/60 uppercase select-none">
                    {displayName?.charAt(0) || '?'}
                  </span>
                </div>
              )}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">
                {medium || 'Artist'}
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-ink leading-tight tracking-tight mb-3 break-words">
                {displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/50 font-serif">
                {location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-wine/40" />
                    {location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs text-ink/35 border border-wine/15 rounded-full px-2.5 py-0.5">
                  Registry profile
                </span>
              </div>
              {(links.length > 0 || website) && (
                <div className="flex flex-wrap gap-4 mt-4">
                  {website && <SocialLinkItem url={website} />}
                  {links.map((link) => (
                    <SocialLinkItem key={link} url={link} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 max-w-6xl py-10 md:py-14 pb-20">
        <div
          className={
            hasSidebarContent
              ? 'grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10 lg:gap-16 items-start'
              : ''
          }
        >
          {/* ── SIDEBAR ── */}
          {hasSidebarContent && (
            <aside className="space-y-8 lg:sticky lg:top-8">
              {bio && (
                <section>
                  <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-3">About</p>
                  <p className="text-ink/80 font-serif text-sm leading-relaxed whitespace-pre-wrap">{bio}</p>
                </section>
              )}

              {galleries.length > 0 && (
                <section className={bio ? 'border-t border-wine/10 pt-8' : ''}>
                  <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-3">
                    Gallery Affiliations
                  </p>
                  <ul className="space-y-2">
                    {galleries.map((gallery) => (
                      <li key={gallery} className="font-serif text-sm text-ink/80 flex items-start gap-2">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-wine/40 flex-shrink-0" />
                        {gallery}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {newsPublications.length > 0 && (
                <section className="border-t border-wine/10 pt-8">
                  <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-4 flex items-center gap-1.5">
                    <Newspaper className="h-3 w-3" />
                    Press
                  </p>
                  <ul className="space-y-4">
                    {newsPublications.map((pub, index) => (
                      <li key={index}>
                        <a
                          href={pub.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-wine/90 hover:text-wine font-serif text-sm font-medium leading-snug hover:underline block"
                        >
                          {pub.title}
                        </a>
                        {(pub.publication_name || pub.date) && (
                          <p className="text-xs text-ink/45 font-serif mt-1">
                            {[pub.publication_name, pub.date].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          )}

          {/* ── MAIN CONTENT ── */}
          <main className="min-w-0">
            {/* Exhibitions */}
            {exhibitions.length > 0 && (
              <section className="mb-12">
                <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-6">
                  Exhibitions
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-wine/10 rounded-lg overflow-hidden border border-wine/10">
                  {exhibitions.map((exhibition) => (
                    <Link
                      key={exhibition.id}
                      href={`/exhibitions/${exhibition.id}`}
                      className="group block p-5 bg-parchment hover:bg-wine/5 transition-colors"
                    >
                      <h3 className="font-display font-semibold text-ink group-hover:text-wine transition-colors mb-3 leading-snug">
                        {exhibition.title}
                      </h3>
                      <div className="space-y-1.5 text-xs text-ink/50 font-serif">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-wine/40" />
                          <span>
                            {new Date(exhibition.start_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                            {exhibition.end_date &&
                              ` – ${new Date(exhibition.end_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}`}
                          </span>
                        </div>
                        {exhibition.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3 text-wine/40" />
                            <span>{exhibition.location}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Artworks */}
            <section>
              <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-6">
                Certified Works
              </p>
              {artworks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                  {artworks.map((artwork) => (
                    <ArtworkCard key={artwork.id} artwork={artwork} currentUserId={currentUserId} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 border border-dashed border-wine/15 rounded-xl">
                  <p className="text-ink/50 font-serif text-sm">
                    No public certified works are linked to this profile yet.
                  </p>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
