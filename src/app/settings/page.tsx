import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { UnifiedProfileSettingsForm } from '~/components/unified-profile-settings-form';
import { getUserGalleryProfiles } from '~/app/artworks/add/_actions/get-user-gallery-profiles';
import { GalleryMembersManager } from '~/app/profiles/_components/gallery-members-manager';
import { logger } from '~/lib/logger';

export const metadata = {
  title: 'Settings | Provenance',
};

export default async function SettingsPage() {
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError) {
      logger.error('settings_auth_get_user_failed', {
        message: authError.message,
        name: authError.name,
      });
      redirect('/auth/sign-in');
    }

    if (!user) {
      redirect('/auth/sign-in');
    }

    let currentName = '';
    let currentMedium = '';
    let currentLinks: string[] | undefined;
    let currentGalleries: string[] | undefined;

    try {
      const {
        data: account,
        error: accountError,
      } = await client
        .from('accounts')
        .select('name, public_data')
        .eq('id', user.id)
        .single();

      if (accountError) {
        logger.error('settings_account_fetch_failed', {
          userId: user.id,
          message: accountError.message,
          code: accountError.code,
        });
      } else if (account) {
        const publicData = (account.public_data as Record<string, unknown>) || {};

        currentName = account.name ?? '';
        currentMedium = (publicData.medium as string) ?? '';

        const links = (publicData.links as unknown) ?? undefined;
        if (Array.isArray(links)) {
          currentLinks = links.filter((l): l is string => typeof l === 'string');
        }

        const galleries = (publicData.galleries as unknown) ?? undefined;
        if (Array.isArray(galleries)) {
          currentGalleries = galleries.filter((g): g is string => typeof g === 'string');
        }
      }
    } catch (accountErr) {
      const err = accountErr instanceof Error ? accountErr : new Error(String(accountErr));
      logger.error('settings_account_fetch_error', {
        userId: user.id,
        message: err.message,
        stack: err.stack,
      });
    }

    let galleryProfiles: Awaited<ReturnType<typeof getUserGalleryProfiles>> = [];
    try {
      galleryProfiles = await getUserGalleryProfiles(user.id);
    } catch (galleryErr) {
      const err = galleryErr instanceof Error ? galleryErr : new Error(String(galleryErr));
      logger.error('settings_gallery_profiles_failed', {
        userId: user.id,
        message: err.message,
        stack: err.stack,
      });
    }

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold text-wine mb-2">
            Settings
          </h1>
          <p className="text-ink/70 font-serif">
            Manage your profile settings and gallery team
          </p>
        </div>

        <div className="flex w-full flex-1 flex-col space-y-6">
          {/* Profile Settings - Name, medium, links, galleries */}
          <Card className="border-wine/20 bg-parchment/60">
            <CardHeader>
              <CardTitle className="font-display text-xl text-wine">
                Profile Settings
              </CardTitle>
              <CardDescription className="font-serif">
                Update your name, default medium, links, and galleries. Your default medium will be automatically filled in when creating new artworks.
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

          {galleryProfiles.length > 0 && (
            <div className="mt-2">
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
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('settings_page_fatal', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    throw error;
  }
}

