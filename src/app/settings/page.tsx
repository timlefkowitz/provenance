import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PersonalAccountSettingsContainer } from '@kit/accounts/personal-account-settings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { UnifiedProfileSettingsForm } from '~/components/unified-profile-settings-form';
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

  // Get account data including name and medium
  const { data: account } = await client
    .from('accounts')
    .select('name, public_data')
    .eq('id', user.id)
    .single();

  const currentName = account?.name || '';
  const currentMedium = (account?.public_data as any)?.medium || '';

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
        {/* Profile Settings - Name and Medium */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Settings</CardTitle>
            <CardDescription>
              Update your name and default medium. Your medium will be automatically filled in when creating new artworks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UnifiedProfileSettingsForm
              userId={user.id}
              currentName={currentName}
              currentMedium={currentMedium}
            />
          </CardContent>
        </Card>

        {/* Other Account Settings - Using PersonalAccountSettingsContainer but name field is redundant */}
        <PersonalAccountSettingsContainer
          userId={user.id}
          paths={paths}
          features={features}
        />
      </div>
    </div>
  );
}

