import { asUntyped } from '~/lib/supabase-untyped';
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
import { ShopSection, type ShopEarning } from './_components/shop-section';
import { payoutHoldDays, platformFeePercent } from '~/lib/payouts/earnings-math';
import { SecuritySection } from './_components/security-section';
import { PrivacySection } from './_components/privacy-section';
import { hasAiConsent } from '~/lib/ai-consent';
import { listMyBlockedUsers } from '~/app/_actions/moderation';
import { getConnectAccount } from '~/lib/stripe-connect';

export const metadata = {
  title: 'Settings | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ require_mfa?: string }>;
}) {
  console.log('[Settings] SettingsPage started');

  // Set by requireAdmin()/requireAdminApi() when an admin's 7-day MFA
  // enrollment grace period has expired (CASA 3.3): admin access is blocked
  // until they enroll a factor, so surface an explanation above the
  // Security section they were redirected to.
  const { require_mfa } = await searchParams;
  const mfaEnrollmentRequired = require_mfa === '1';

  if (mfaEnrollmentRequired) {
    console.log('[Settings] admin redirected here for forced MFA enrollment');
  }

  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const subscriptionNowIso = new Date().toISOString();
  const [accountResult, allProfiles, galleryProfiles, subscriptionResult, connectAccount, aiConsented, blockedUsers, earningsResult, sitesResult] =
    await Promise.all([
      client
        .from('accounts')
        .select('id, name, email, picture_url, public_data')
        .eq('id', user.id)
        .single(),
      getUserProfiles(user.id),
      getUserGalleryProfiles(user.id),
      asUntyped(client)
        .from('subscriptions')
        .select('id, role, status, current_period_end, trial_end, provider')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .or(
          `current_period_end.is.null,current_period_end.gte.${subscriptionNowIso}`,
        )
        .order('current_period_end', { ascending: false })
        .limit(1),
      getConnectAccount(user.id),
      hasAiConsent(user.id),
      listMyBlockedUsers(),
      client
        .from('seller_earnings')
        .select('id, artwork_title, gross_cents, platform_fee_cents, stripe_fee_cents, net_cents, currency, status, release_at, created_at')
        .eq('seller_account_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      client
        .from('profile_sites')
        .select('handle, published_at, user_profiles!inner(user_id)')
        .eq('user_profiles.user_id', user.id)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(1),
    ]);

  const account = accountResult.data;
  const publicData = (account?.public_data as Record<string, unknown>) || {};
  const subscription = subscriptionResult.data?.[0] ?? null;
  const earnings = (earningsResult.data ?? []) as ShopEarning[];
  const siteRow = sitesResult.data?.[0] as { handle: string; published_at: string | null } | undefined;
  const siteHost = (() => {
    const host = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://provenance.guru').hostname;
    return host.startsWith('www.') ? host.slice(4) : host;
  })();
  const shopSite = siteRow
    ? {
        published: !!siteRow.published_at,
        url: siteRow.published_at ? `https://${siteRow.handle}.${siteHost}` : null,
      }
    : null;

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

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
        <SettingsNav hasGalleryProfiles={galleryProfiles.length > 0} />

        <div className="flex-1 min-w-0 space-y-16">
          <AccountSection
            userId={user.id}
            email={user.email || ''}
            name={account?.name || ''}
            pictureUrl={account?.picture_url || ''}
            medium={(publicData.medium as string) || ''}
            links={(publicData.links as string[]) || []}
            galleries={(publicData.galleries as string[]) || []}
            firstProfileId={firstEditableProfile?.id ?? null}
          />

          <ProfilesSection profiles={editableProfiles} />

          <BillingSection subscription={subscription} />

          <ShopSection
            shopOpen={!!connectAccount}
            payoutsEnabled={!!connectAccount?.payouts_enabled}
            earnings={earnings}
            feePercent={platformFeePercent()}
            holdDays={payoutHoldDays()}
            site={shopSite}
          />

          <AppearanceSection />

          <TeamsSection
            galleryProfiles={galleryProfiles}
            userId={user.id}
          />

          <SecuritySection
            userId={user.id}
            email={user.email || ''}
            mfaEnrollmentRequired={mfaEnrollmentRequired}
          />

          <PrivacySection aiConsented={aiConsented} blockedUsers={blockedUsers} />

          <AccountActionsSection />
        </div>
      </div>
    </div>
  );
}
