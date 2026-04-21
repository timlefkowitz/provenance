import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfiles } from '~/app/profiles/_actions/get-user-profiles';
import { getUserGalleryProfiles } from '~/app/artworks/add/_actions/get-user-gallery-profiles';
import { USER_ROLES } from '~/lib/user-roles';
import { SettingsNav } from './_components/settings-nav';
import { AccountSection } from './_components/account-section';
import { ProfilesSection } from './_components/profiles-section';
import { BillingSection } from './_components/billing-section';
import { AppearanceSection } from './_components/appearance-section';
import { TeamsSection } from './_components/teams-section';
import { AccountActionsSection } from './_components/account-actions-section';

export const metadata = {
  title: 'Settings | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  console.log('[Settings] SettingsPage started');

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const subscriptionNowIso = new Date().toISOString();
  const [accountResult, allProfiles, galleryProfiles, subscriptionResult] =
    await Promise.all([
      client
        .from('accounts')
        .select('id, name, email, picture_url, public_data')
        .eq('id', user.id)
        .single(),
      getUserProfiles(user.id),
      getUserGalleryProfiles(user.id),
      (client as any)
        .from('subscriptions')
        .select('id, role, status, current_period_end, trial_end')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .or(
          `current_period_end.is.null,current_period_end.gte.${subscriptionNowIso}`,
        )
        .order('current_period_end', { ascending: false })
        .limit(1),
    ]);

  const account = accountResult.data;
  const publicData = (account?.public_data as Record<string, any>) || {};
  const subscription = subscriptionResult.data?.[0] ?? null;

  const editableProfiles = allProfiles.filter(
    (p) => p.role === USER_ROLES.GALLERY || p.role === USER_ROLES.ARTIST,
  );

  const firstEditableProfile = editableProfiles[0] ?? null;

  console.log('[Settings] SettingsPage loaded', {
    profileCount: allProfiles.length,
    galleryProfileCount: galleryProfiles.length,
    hasSubscription: !!subscription,
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Settings
        </h1>
        <p className="text-ink/70 font-serif">
          Manage your account, profiles, subscription, and preferences.
        </p>
      </div>

      <div className="flex gap-10">
        <SettingsNav hasGalleryProfiles={galleryProfiles.length > 0} />

        <div className="flex-1 min-w-0 space-y-16">
          <AccountSection
            userId={user.id}
            email={user.email || ''}
            name={account?.name || ''}
            pictureUrl={account?.picture_url || ''}
            medium={publicData.medium || ''}
            links={(publicData.links as string[]) || []}
            galleries={(publicData.galleries as string[]) || []}
            firstProfileId={firstEditableProfile?.id ?? null}
          />

          <ProfilesSection profiles={editableProfiles} />

          <BillingSection subscription={subscription} />

          <AppearanceSection />

          <TeamsSection
            galleryProfiles={galleryProfiles}
            userId={user.id}
          />

          <AccountActionsSection />
        </div>
      </div>
    </div>
  );
}
