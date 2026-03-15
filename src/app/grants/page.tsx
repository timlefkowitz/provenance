import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { getArtistGrants } from './_actions/get-artist-grants';
import { USER_ROLES } from '~/lib/user-roles';
import { GrantsPageContent } from './_components/grants-page-content';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';

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
    console.log('[Grants] page: no artist profile, showing CTA');
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold text-wine mb-2">
            Grants
          </h1>
          <p className="text-ink/70 font-serif">
            Find grants and opportunities matched to your practice.
          </p>
        </div>
        <Card className="border-wine/20 bg-parchment/60 max-w-xl">
          <CardHeader>
            <CardTitle className="font-display text-xl text-wine">
              Create an artist profile first
            </CardTitle>
            <p className="text-ink/70 font-serif text-sm">
              Grants are available for artists. Create an artist profile from your profiles page, then return here to upload your CV and find opportunities.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
              <Link href="/profiles">Go to Profiles</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const grants = await getArtistGrants(user.id);
  const hasCv = Boolean(artistProfile.artist_cv_json || artistProfile.artist_cv_file_url);
  console.log('[Grants] page: loaded', { grantsCount: grants.length, hasCv });

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Grants
        </h1>
        <p className="text-ink/70 font-serif">
          Browse grants and opportunities below. Upload your CV to get personalized recommendations from the assistant.
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
