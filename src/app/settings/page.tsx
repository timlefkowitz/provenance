import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PersonalAccountSettingsContainer } from '@kit/accounts/personal-account-settings';
import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { getUserGalleryProfiles } from '~/app/artworks/add/_actions/get-user-gallery-profiles';
import { GalleryMembersManager } from '~/app/profiles/_components/gallery-members-manager';

export const metadata = {
  title: 'Settings | Provenance',
};

const callbackPath = pathsConfig.auth.callback;

const features = {
  enableAccountDeletion: true,
  enablePasswordUpdate: authConfig.providers.password,
  enableMfa: false,
};

const paths = {
  callback: callbackPath + `?next=${pathsConfig.app.profileSettings}`,
};

export default async function SettingsPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const { data: account } = await client
    .from('accounts')
    .select('id, name, picture_url')
    .eq('id', user.id)
    .maybeSingle();

  const initialAccount = account
    ? { id: account.id, name: account.name ?? null, picture_url: account.picture_url ?? null }
    : null;

  const galleryProfiles = await getUserGalleryProfiles(user.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Settings
        </h1>
        <p className="text-ink/70 font-serif">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="flex w-full flex-1 flex-col space-y-4">
        {/* Account Settings - Security, Password, etc. */}
        <PersonalAccountSettingsContainer
          userId={user.id}
          initialAccount={initialAccount}
          initialUserEmail={user.email ?? undefined}
          paths={paths}
          features={features}
        />

        {galleryProfiles.length > 0 && (
          <div className="mt-6">
            <h2 className="text-2xl font-display font-bold text-wine mb-2">
              Gallery team
            </h2>
            <p className="text-ink/70 font-serif mb-4">
              Manage team members for your gallery profiles. Team members can manage collections, post Certificates of Show, and manage exhibitions for that gallery.
            </p>
            <div className="space-y-6">
              {galleryProfiles.map((profile) => (
                <GalleryMembersManager
                  key={profile.id}
                  galleryProfileId={profile.id}
                  userId={user.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

