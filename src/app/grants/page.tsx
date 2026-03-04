import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { getArtistGrants } from './_actions/get-artist-grants';
import { USER_ROLES } from '~/lib/user-roles';
import { GrantsPageContent } from './_components/grants-page-content';

export const metadata = {
  title: 'Grants | Provenance',
  description: 'Find grants and opportunities matched to your artist profile',
};

export default async function GrantsPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const artistProfile = await getUserProfileByRole(user.id, USER_ROLES.ARTIST);
  if (!artistProfile) {
    redirect('/portal');
  }

  const grants = await getArtistGrants(user.id);
  const hasCv = Boolean(artistProfile.artist_cv_json || artistProfile.artist_cv_file_url);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Grants
        </h1>
        <p className="text-ink/70 font-serif">
          Find grants and opportunities matched to your practice. Upload your CV, then use the assistant to discover options.
        </p>
      </div>

      <GrantsPageContent
        userId={user.id}
        initialGrants={grants}
        hasCv={hasCv}
        artistProfileId={artistProfile.id}
        artistLocation={(artistProfile.artist_cv_json as { location?: string })?.location ?? artistProfile.location ?? null}
      />
    </div>
  );
}
