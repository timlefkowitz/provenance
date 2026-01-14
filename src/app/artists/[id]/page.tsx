import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { ArtworkCard } from '../../artworks/_components/artwork-card';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { getExhibitionsForGallery } from '../../exhibitions/_actions/get-exhibitions';
import { getUserProfileByRole } from '../../profiles/_actions/get-user-profiles';
import { Calendar, MapPin } from 'lucide-react';

export const metadata = {
  title: 'Artist Profile | Provenance',
};

type Account = {
  id: string;
  name: string;
  picture_url: string | null;
  public_data: any;
  created_at: string | null;
};

export default async function ArtistProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ role?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedRole = resolvedSearchParams?.role;
  
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: account, error } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data, created_at')
    .eq('id', id)
    .single<Account>();

  if (error || !account) {
    redirect('/registry');
  }

  const isOwner = user?.id === account.id;
  
  // Use requested role from query param if provided, otherwise get from account
  let userRole: string | null = null;
  if (requestedRole && ['artist', 'collector', 'gallery'].includes(requestedRole)) {
    userRole = requestedRole;
  } else {
    userRole = getUserRole(account.public_data as Record<string, any>);
  }
  
  const isGallery = userRole === USER_ROLES.GALLERY;

  // Try to get role-specific profile, fallback to account data
  const roleProfile = userRole ? await getUserProfileByRole(account.id, userRole as any) : null;
  
  // Use profile data if available, otherwise fall back to account public_data
  const displayName = roleProfile?.name || account.name;
  const medium = roleProfile?.medium || account.public_data?.medium || '';
  const links = roleProfile?.links || (account.public_data?.links as string[]) || [];
  const galleries = roleProfile?.galleries || (account.public_data?.galleries as string[]) || [];
  const bio = roleProfile?.bio || '';
  const location = roleProfile?.location || '';
  const website = roleProfile?.website || '';
  const establishedYear = roleProfile?.established_year;
  const pictureUrl = roleProfile?.picture_url || account.picture_url;

  // Fetch exhibitions if this is a gallery
  const exhibitions = isGallery ? await getExhibitionsForGallery(account.id) : [];

  // Fetch this artist's artworks
  let artworksQuery = client
    .from('artworks')
    .select(
      'id, title, artist_name, image_url, created_at, certificate_number, account_id, is_public, status',
    )
    .eq('account_id', account.id)
    .eq('status', 'verified')
    .order('created_at', { ascending: false })
    .limit(48);

  if (!isOwner) {
    artworksQuery = artworksQuery.eq('is_public', true);
  }

  const { data: artworks } = await artworksQuery;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-wine/30 bg-wine/10">
            {pictureUrl ? (
              <Image
                src={pictureUrl}
                alt={displayName}
                fill
                className="object-cover"
                unoptimized
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
              <p className="text-ink/70 font-serif text-base md:text-lg italic">
                {medium}
              </p>
            )}
            {location && (
              <p className="text-sm text-ink/60 font-serif mt-1">
                {location}
                {isGallery && establishedYear && ` • Established ${establishedYear}`}
              </p>
            )}
            {!isGallery && account.created_at && (
              <p className="text-xs text-ink/50 font-serif mt-2">
                Member since{' '}
                {new Date(account.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                })}
              </p>
            )}
          </div>
        </div>

        {isOwner && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              size="sm"
            >
              <Link href="/profile">Edit Profile</Link>
            </Button>
            {isGallery && (
              <Button
                asChild
                variant="outline"
                className="font-serif border-wine/30 hover:bg-wine/10"
                size="sm"
              >
                <Link href="/exhibitions">Manage Exhibitions</Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="font-serif border-wine/30 hover:bg-wine/10"
              size="sm"
            >
              <Link href="/settings">Account Settings</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Bio */}
      {bio && (
        <Card className="mb-10 border-wine/20 bg-parchment/60">
          <CardContent className="p-5 md:p-6">
            <h2 className="font-display text-xl text-wine mb-3">About</h2>
            <p className="text-ink font-serif whitespace-pre-wrap">{bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Links */}
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

      {/* Website */}
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

      {/* Galleries */}
      {galleries.length > 0 && (
        <Card className="mb-10 border-wine/20 bg-parchment/60">
          <CardContent className="p-5 md:p-6">
            <h2 className="font-display text-xl text-wine mb-3">
              Galleries
            </h2>
            <ul className="list-disc list-inside space-y-1 text-sm md:text-base font-serif text-ink">
              {galleries.map((gallery) => (
                <li key={gallery}>{gallery}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Exhibitions (for galleries) */}
      {isGallery && exhibitions.length > 0 && (
        <Card className="mb-10 border-wine/20 bg-parchment/60">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl text-wine">Exhibitions</h2>
              {isOwner && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="font-serif border-wine/30 hover:bg-wine/10"
                >
                  <Link href="/exhibitions">Manage</Link>
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exhibitions.slice(0, 6).map((exhibition) => (
                <Link
                  key={exhibition.id}
                  href={`/exhibitions/${exhibition.id}`}
                  className="block p-4 border border-wine/10 rounded-md hover:bg-wine/5 transition-colors"
                >
                  <h3 className="font-display font-semibold text-wine mb-2">
                    {exhibition.title}
                  </h3>
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
            {exhibitions.length > 6 && (
              <div className="mt-4 text-center">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="font-serif"
                >
                  <Link href="/exhibitions">
                    View All Exhibitions ({exhibitions.length})
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Artworks Grid */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-display font-bold text-wine">
          Artworks
        </h2>
        {isOwner && (
          <Button
            asChild
            size="sm"
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          >
            <Link href="/artworks/add">Add Artwork</Link>
          </Button>
        )}
      </div>

      {artworks && artworks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {artworks.map((artwork) => (
            <ArtworkCard
              key={artwork.id}
              artwork={artwork as any}
              currentUserId={user?.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-wine/20 rounded-lg bg-parchment/40">
          <p className="text-ink/70 font-serif text-base md:text-lg mb-2">
            {isOwner
              ? 'You have not added any artworks yet.'
              : 'This artist has not added any artworks yet.'}
          </p>
          {isOwner && (
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif mt-2"
            >
              <Link href="/artworks/add">Add Your First Artwork</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}


