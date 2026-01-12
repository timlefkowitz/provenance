import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { UnifiedProfileSettingsForm } from '~/components/unified-profile-settings-form';
import { ProfileArtworksSection } from './_components/profile-artworks-section';

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
  const publicData = (account?.public_data as any) || {};
  const currentMedium = publicData.medium || '';
  const currentLinks = (publicData.links as string[]) || [];
  const currentGalleries = (publicData.galleries as string[]) || [];
  const currentPictureUrl = account?.picture_url || '';

  // Fetch user's artworks
  const { data: artworks } = await client
    .from('artworks')
    .select(
      'id, title, artist_name, image_url, created_at, certificate_number, description, creation_date',
    )
    .eq('account_id', user.id)
    .eq('status', 'verified')
    .order('created_at', { ascending: false });

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
        {/* Avatar & Photo Change Shortcut */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-wine/30 bg-wine/10">
                {currentPictureUrl ? (
                  <Image
                    src={currentPictureUrl}
                    alt={currentName || 'Profile photo'}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-wine/10">
                    <span className="text-2xl font-display font-bold text-wine uppercase">
                      {currentName?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <CardTitle>Your Profile Photo</CardTitle>
                <CardDescription>
                  This photo appears on your artist profile and in the registry.
                </CardDescription>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif w-full sm:w-auto"
            >
              <a href="/settings">Change Photo in Settings</a>
            </Button>
          </CardHeader>
        </Card>

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your public profile. These details appear on your artist
              page and when people view your artworks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UnifiedProfileSettingsForm
              userId={user.id}
              currentName={currentName}
              currentMedium={currentMedium}
              currentLinks={currentLinks}
              currentGalleries={currentGalleries}
            />
          </CardContent>
        </Card>

        {/* Artworks Section with Selection */}
        <ProfileArtworksSection artworks={artworks || []} />
      </div>
    </div>
  );
}

