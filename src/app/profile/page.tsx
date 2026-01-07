import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { UnifiedProfileSettingsForm } from '~/components/unified-profile-settings-form';

export const metadata = {
  title: 'Profile | Provenance',
};

export default async function ProfilePage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Get account data including name, medium, and picture_url
  const { data: account } = await client
    .from('accounts')
    .select('name, picture_url, public_data')
    .eq('id', user.id)
    .single();

  const currentName = account?.name || '';
  const currentMedium = (account?.public_data as any)?.medium || '';
  const currentPictureUrl = account?.picture_url || '';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Profile
        </h1>
        <p className="text-ink/70 font-serif">
          Edit your profile information. Your name and medium will be used when creating artworks.
        </p>
      </div>

      <div className="flex w-full flex-1 flex-col space-y-4">
        {/* Profile Settings - Name and Medium */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
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
      </div>
    </div>
  );
}

