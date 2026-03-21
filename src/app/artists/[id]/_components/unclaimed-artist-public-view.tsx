import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@kit/ui/card';
import {
  ArtworkCard,
  type ArtworkCardArtwork,
} from '~/app/artworks/_components/artwork-card';
import { Calendar, MapPin, Newspaper } from 'lucide-react';

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

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-wine/30 bg-wine/10">
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
              <div className="w-full h-full flex items-center justify-center bg-wine/10">
                <span className="text-3xl font-display font-bold text-wine uppercase">
                  {displayName?.charAt(0) || '?'}
                </span>
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-wine mb-1">
              {displayName}
            </h1>
            {medium && (
              <p className="text-ink/70 font-serif text-base md:text-lg italic">{medium}</p>
            )}
            {location && (
              <p className="text-sm text-ink/60 font-serif mt-1">{location}</p>
            )}
            <p className="text-xs text-ink/50 font-serif mt-2">
              Registry profile — this artist can claim this page to manage it.
            </p>
          </div>
        </div>
      </div>

      {bio && (
        <Card className="mb-10 border-wine/20 bg-parchment/60">
          <CardContent className="p-5 md:p-6">
            <h2 className="font-display text-xl text-wine mb-3">About</h2>
            <p className="text-ink font-serif whitespace-pre-wrap">{bio}</p>
          </CardContent>
        </Card>
      )}

      {links.length > 0 && (
        <Card className="mb-10 border-wine/20 bg-parchment/60">
          <CardContent className="p-5 md:p-6">
            <h2 className="font-display text-xl text-wine mb-3">Links</h2>
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-wine hover:text-wine/80 hover:underline break-all font-serif text-sm"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {website && (
        <Card className="mb-10 border-wine/20 bg-parchment/60">
          <CardContent className="p-5 md:p-6">
            <h2 className="font-display text-xl text-wine mb-3">Website</h2>
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              className="text-wine hover:text-wine/80 hover:underline break-all font-serif text-sm"
            >
              {website}
            </a>
          </CardContent>
        </Card>
      )}

      {galleries.length > 0 && (
        <Card className="mb-10 border-wine/20 bg-parchment/60">
          <CardContent className="p-5 md:p-6">
            <h2 className="font-display text-xl text-wine mb-3">Galleries</h2>
            <ul className="list-disc list-inside space-y-1 text-sm md:text-base font-serif text-ink">
              {galleries.map((gallery) => (
                <li key={gallery}>{gallery}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {newsPublications.length > 0 && (
        <Card className="mb-10 border-wine/20 bg-parchment/60">
          <CardContent className="p-5 md:p-6">
            <h2 className="font-display text-xl text-wine mb-3 flex items-center gap-2">
              <Newspaper className="h-5 w-5" />
              News & Publications
            </h2>
            <ul className="space-y-3">
              {newsPublications.map((pub, index) => (
                <li
                  key={index}
                  className="border-b border-wine/10 last:border-0 pb-3 last:pb-0"
                >
                  <a
                    href={pub.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-wine hover:text-wine/80 hover:underline font-serif font-medium block"
                  >
                    {pub.title}
                  </a>
                  {(pub.publication_name || pub.date) && (
                    <p className="text-sm text-ink/70 font-serif mt-1">
                      {[pub.publication_name, pub.date].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {exhibitions.length > 0 && (
        <Card className="mb-10 border-wine/20 bg-parchment/60">
          <CardContent className="p-5 md:p-6">
            <h2 className="font-display text-xl text-wine mb-3">Exhibitions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exhibitions.map((exhibition) => (
                <Link
                  key={exhibition.id}
                  href={`/exhibitions/${exhibition.id}`}
                  className="block p-4 border border-wine/10 rounded-md hover:bg-wine/5 transition-colors"
                >
                  <h3 className="font-display font-semibold text-wine mb-2">{exhibition.title}</h3>
                  <div className="space-y-1 text-sm text-ink/70 font-serif">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(exhibition.start_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                        {exhibition.end_date &&
                          ` - ${new Date(exhibition.end_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}`}
                      </span>
                    </div>
                    {exhibition.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        <span>{exhibition.location}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-display font-bold text-wine">Certified works</h2>
      </div>

      {artworks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {artworks.map((artwork) => (
            <ArtworkCard key={artwork.id} artwork={artwork} currentUserId={currentUserId} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-wine/20 rounded-lg bg-parchment/40">
          <p className="text-ink/70 font-serif text-base md:text-lg">
            No public certified works are linked to this profile yet.
          </p>
        </div>
      )}
    </div>
  );
}
