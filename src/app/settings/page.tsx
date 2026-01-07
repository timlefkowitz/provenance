import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PersonalAccountSettingsContainer } from '@kit/accounts/personal-account-settings';
import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';

export const metadata = {
  title: 'Settings | Provenance',
};

const callbackPath = pathsConfig.auth.callback;

const features = {
  enableAccountDeletion: true,
  enablePasswordUpdate: authConfig.providers.password,
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
          paths={paths}
          features={features}
        />
      </div>
    </div>
  );
}

