import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { ArtworkCard } from '../../artworks/_components/artwork-card';

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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
  const medium = account.public_data?.medium || '';
  const cv = account.public_data?.cv as string | null;
  const links = (account.public_data?.links as string[]) || [];
  const galleries = (account.public_data?.galleries as string[]) || [];

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
            {account.picture_url ? (
              <Image
                src={account.picture_url}
                alt={account.name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-wine/10">
                <span className="text-3xl font-display font-bold text-wine uppercase">
                  {account.name?.charAt(0) || '?'}
                </span>
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-wine mb-1">
              {account.name}
            </h1>
            {medium && (
              <p className="text-ink/70 font-serif text-base md:text-lg italic">
                {medium}
              </p>
            )}
            {account.created_at && (
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

      {/* CV / Bio */}
      {cv && (
        <Card className="mb-10 border-wine/20 bg-parchment/60">
          <CardContent className="p-5 md:p-6">
            <h2 className="font-display text-xl text-wine mb-2">
              CV / Artist Bio
            </h2>
            <p className="text-sm md:text-base font-serif text-ink whitespace-pre-wrap">
              {cv}
            </p>
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


