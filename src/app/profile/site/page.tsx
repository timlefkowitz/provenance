import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getActiveSubscription } from '~/lib/subscription';
import { getSiteConfig } from './_actions/get-site-config';
import { getManageableProfiles } from './_actions/get-manageable-profiles';
import { findProfileWithSite } from './_actions/find-profile-with-site';
import { SiteEditor } from './_components/site-editor';
import { Button } from '@kit/ui/button';

export const metadata = {
  title: 'My Website | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function ProfileSitePage({
  searchParams,
}: {
  searchParams?: Promise<{ profileId?: string }>;
}) {
  const params = (await searchParams) ?? {};

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // ── Subscription gate ──
  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    return (
      <div className="container mx-auto px-4 max-w-2xl py-16 text-center">
        <p className="text-xs uppercase tracking-widest text-ink/40 font-serif mb-4">
          Creator Website
        </p>
        <h1 className="text-3xl font-display font-bold text-ink mb-4">
          Your own website, powered by Provenance
        </h1>
        <p className="text-ink/60 font-serif mb-8 leading-relaxed">
          Publish a beautiful, chromeless site at{' '}
          <span className="text-wine font-medium">yourname.provenance.guru</span> —
          populated automatically from your artworks, exhibitions, and press.
          Included with every Provenance subscription.
        </p>
        <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
          <Link href="/subscription">Unlock with a subscription</Link>
        </Button>
      </div>
    );
  }

  // ── Manageable profiles ──
  const manageableProfiles = await getManageableProfiles();

  if (manageableProfiles.length === 0) {
    return (
      <div className="container mx-auto px-4 max-w-2xl py-16 text-center">
        <h1 className="text-2xl font-display font-bold text-ink mb-4">
          Create a profile first
        </h1>
        <p className="text-ink/60 font-serif mb-6">
          Your website pulls content from your Provenance profile. Set one up to get started.
        </p>
        <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
          <Link href="/profiles/new">Create profile</Link>
        </Button>
      </div>
    );
  }

  // Choose which profile we're editing.
  // Priority: explicit ?profileId= → first manageable profile that has a saved site
  //           → first manageable profile.
  const requestedId = params.profileId;
  const explicitMatch = manageableProfiles.find((p) => p.id === requestedId);

  let activeProfile = explicitMatch ?? null;

  if (!activeProfile) {
    const profileWithSiteId = await findProfileWithSite(
      manageableProfiles.map((p) => p.id),
    );
    if (profileWithSiteId) {
      activeProfile = manageableProfiles.find((p) => p.id === profileWithSiteId) ?? null;
    }
  }

  if (!activeProfile) {
    activeProfile = manageableProfiles[0];
  }

  console.log('[Sites] /profile/site active profile resolved', {
    requestedId: requestedId ?? null,
    activeProfileId: activeProfile.id,
    activeProfileName: activeProfile.name,
  });

  const existingConfig = await getSiteConfig(activeProfile.id);

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <div className="border-b border-wine/15 bg-parchment/60 sticky top-[57px] z-30 backdrop-blur-sm">
        <div className="container mx-auto px-4 max-w-7xl py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif mb-1">
                Creator Website
              </p>
              <h1 className="text-xl font-display font-bold text-ink">Your Website</h1>
            </div>
            <Button asChild variant="ghost" size="sm" className="font-serif text-ink/60 hover:text-ink shrink-0">
              <Link href="/profile">← Back to profile</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Editor + Preview ── */}
      <div className="container mx-auto px-4 max-w-7xl py-6 pb-20">
        <SiteEditor
          profileId={activeProfile.id}
          profile={{
            name: activeProfile.name,
            role: activeProfile.role,
            source: activeProfile.source,
            team_role: activeProfile.team_role,
          }}
          manageableProfiles={manageableProfiles}
          initialConfig={existingConfig}
          siteDomain={existingConfig?.siteDomain ?? 'provenance.guru'}
        />
      </div>
    </div>
  );
}
