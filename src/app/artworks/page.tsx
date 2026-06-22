import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { ArtworkFeed } from './_components/artwork-feed';
import { NewUserConversionTracker } from '~/app/portal/_components/new-user-conversion-tracker';

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
    <>
      {/* Fires GTM signup + trial_started events on first landing after auth callback */}
      <NewUserConversionTracker />
      <ArtworkFeed currentUserId={user?.id} isSignedIn={!!user} />
    </>
  );
}
