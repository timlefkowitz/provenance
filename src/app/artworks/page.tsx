import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { ArtworkFeed } from './_components/artwork-feed';

export const metadata = {
  title: 'Artworks | Provenance',
};

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function ArtworksPage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  return (
    <ArtworkFeed currentUserId={user?.id} isSignedIn={!!user} />
  );
}
