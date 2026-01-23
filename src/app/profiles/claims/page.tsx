import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { getPendingClaims, getUnclaimedProfiles } from '../_actions/get-pending-claims';
import { UnclaimedProfilesList } from '../_components/unclaimed-profiles-list';
import { PendingClaimsList } from '../_components/pending-claims-list';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@kit/ui/card';

export const metadata = {
  title: 'Profile Claims | Provenance',
};

export default async function ProfileClaimsPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Get user role
  const { data: account } = await client
    .from('accounts')
    .select('id, public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    redirect('/profile');
  }

  const userRole = getUserRole(account.public_data as Record<string, any>);

  // For artists: show unclaimed profiles
  // For galleries: show pending claims
  const isArtist = userRole === USER_ROLES.ARTIST;
  const isGallery = userRole === USER_ROLES.GALLERY;

  if (!isArtist && !isGallery) {
    redirect('/profile');
  }

  const unclaimedProfiles = isArtist ? await getUnclaimedProfiles(user.id) : [];
  const pendingClaims = isGallery ? await getPendingClaims(user.id) : [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          {isArtist ? 'Claim Artist Profile' : 'Artist Profile Claims'}
        </h1>
        <p className="text-ink/70 font-serif">
          {isArtist
            ? 'Browse unclaimed artist profiles created by galleries. If you find your name, you can claim it.'
            : 'Review and approve artist profile claims. Artists are requesting to claim profiles you created.'}
        </p>
      </div>

      {isArtist && (
        <Card>
          <CardHeader>
            <CardTitle>Available Profiles to Claim</CardTitle>
            <CardDescription>
              These artist profiles were created by galleries when they added artwork. 
              If one matches your name, you can request to claim it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UnclaimedProfilesList profiles={unclaimedProfiles} />
          </CardContent>
        </Card>
      )}

      {isGallery && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Profile Claims</CardTitle>
            <CardDescription>
              Artists are requesting to claim profiles you created. Review each request and approve or reject it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PendingClaimsList claims={pendingClaims} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

