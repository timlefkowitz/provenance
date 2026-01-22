import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { getUserProfiles } from './_actions/get-user-profiles';
import { ProfilesList } from './_components/profiles-list';
import { CreateProfileButton } from './_components/create-profile-button';
import { USER_ROLES, getRoleLabel } from '~/lib/user-roles';
import { Plus } from 'lucide-react';

export const metadata = {
  title: 'Manage Profiles | Provenance',
};

export default async function ProfilesPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const profiles = await getUserProfiles(user.id);

  // Determine which roles don't have profiles yet
  // Gallery can always be created (multiple galleries allowed)
  const existingRoles = new Set(profiles.map(p => p.role));
  const availableRoles = Object.values(USER_ROLES).filter(
    role => role === 'gallery' || !existingRoles.has(role)
  );
  
  // Count galleries separately
  const galleryProfiles = profiles.filter(p => p.role === 'gallery');

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Manage Your Profiles
        </h1>
        <p className="text-ink/70 font-serif">
          Create and manage separate profiles for each role (Artist, Collector, Gallery)
        </p>
      </div>

      {/* Create New Profile Section */}
      {availableRoles.length > 0 && (
        <Card className="mb-8 border-wine/20 bg-parchment/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-wine">
              Create New Profile
            </CardTitle>
            <CardDescription className="font-serif">
              {galleryProfiles.length > 0 
                ? 'You can create multiple gallery profiles. Each profile has its own name, bio, and settings.'
                : 'You can create separate profiles for each role. Each profile has its own name, bio, and settings.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {availableRoles.map((role) => (
                <CreateProfileButton key={role} role={role} />
              ))}
            </div>
            {galleryProfiles.length > 0 && (
              <p className="mt-4 text-sm text-ink/60 font-serif italic">
                You currently have {galleryProfiles.length} gallery profile{galleryProfiles.length !== 1 ? 's' : ''}. You can create additional gallery profiles.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Existing Profiles */}
      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <CardTitle className="font-display text-xl text-wine">
            Your Profiles
          </CardTitle>
          <CardDescription className="font-serif">
            {profiles.length === 0
              ? 'You haven\'t created any profiles yet. Create one to get started!'
              : `You have ${profiles.length} profile${profiles.length !== 1 ? 's' : ''} created.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length > 0 ? (
            <ProfilesList profiles={profiles} />
          ) : (
            <div className="text-center py-8">
              <p className="text-ink/60 font-serif mb-4">
                No profiles created yet
              </p>
              {availableRoles.length > 0 && (
                <div className="flex flex-wrap gap-3 justify-center">
                  {availableRoles.map((role) => (
                    <CreateProfileButton key={role} role={role} />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

