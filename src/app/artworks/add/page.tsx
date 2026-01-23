import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { AddArtworkPageContent } from './_components/add-artwork-page-content';
import { getUserExhibitions } from './_actions/get-user-exhibitions';
import { getPastArtists } from './_actions/get-past-artists';
import { ensureArtistsInRegistry } from './_actions/ensure-artists-in-registry';
import { getUserGalleryProfiles } from './_actions/get-user-gallery-profiles';

export const metadata = {
  title: 'Add Artwork | Provenance',
};

export default async function AddArtworkPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Get account name, medium, and role for auto-filling
  const { data: account } = await client
    .from('accounts')
    .select('name, public_data')
    .eq('id', user.id)
    .single();

  const artistName = account?.name || '';
  const defaultMedium = (account?.public_data as any)?.medium || '';
  const userRole = getUserRole(account?.public_data as Record<string, any>);
  
  // Get exhibitions for galleries
  const exhibitions = await getUserExhibitions(user.id);
  
  // Get past artists for galleries
  const pastArtists = userRole === USER_ROLES.GALLERY ? await getPastArtists(user.id) : [];

  // Get gallery profiles for galleries (users can have multiple gallery profiles)
  const galleryProfiles = userRole === USER_ROLES.GALLERY ? await getUserGalleryProfiles(user.id) : [];

  // Ensure past artists are in the registry as unclaimed profiles
  // This makes sure all past artists are available for claiming
  if (userRole === USER_ROLES.GALLERY && pastArtists.length > 0) {
    const artistNames = pastArtists
      .filter(artist => !artist.artist_account_id) // Only ensure artists without accounts
      .map(artist => artist.artist_name);
    
    if (artistNames.length > 0) {
      try {
        await ensureArtistsInRegistry(artistNames, user.id);
      } catch (error) {
        // Don't fail page load if this fails - just log the error
        console.error('Error ensuring artists in registry:', error);
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <AddArtworkPageContent
        userId={user.id}
        defaultArtistName={artistName}
        defaultMedium={defaultMedium}
        userRole={userRole}
        exhibitions={exhibitions}
        pastArtists={pastArtists}
        galleryProfiles={galleryProfiles}
      />
    </div>
  );
}
