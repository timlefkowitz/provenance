import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PersonalAccountSettingsContainer } from '@kit/accounts/personal-account-settings';
import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { getUserGalleryProfiles } from '~/app/artworks/add/_actions/get-user-gallery-profiles';
import { GalleryMembersManager } from '~/app/profiles/_components/gallery-members-manager';
import { logger } from '~/lib/logger';

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
  try {
    const client = getSupabaseServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();

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

    let initialAccount: { id: string; name: string | null; picture_url: string | null } | null = null;
    try {
      const { data: account, error: accountError } = await client
        .from('accounts')
        .select('id, name, picture_url')
        .eq('id', user.id)
        .maybeSingle();

      if (accountError) {
        logger.error('settings_account_fetch_failed', {
          userId: user.id,
          message: accountError.message,
          code: accountError.code,
        });
      } else if (account) {
        initialAccount = {
          id: account.id,
          name: account.name ?? null,
          picture_url: account.picture_url ?? null,
        };
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

