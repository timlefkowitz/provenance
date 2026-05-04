import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getActiveSubscription } from '~/lib/subscription';
import { getUserProfiles } from '~/app/profiles/_actions/get-user-profiles';
import { getSiteConfig } from './_actions/get-site-config';
import { SiteEditor } from './_components/site-editor';
import { Button } from '@kit/ui/button';

export const metadata = {
  title: 'My Website | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function ProfileSitePage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // ── Subscription gate ──────────────────────────────────────────────────────
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
          <span className="text-wine font-medium">yourname.provenance.app</span> — 
          populated automatically from your artworks, exhibitions, and press.
          Included with every Provenance subscription.
        </p>
        <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
          <Link href="/subscription">Unlock with a subscription</Link>
        </Button>
      </div>
    );
  }

  // ── Profile selection ──────────────────────────────────────────────────────
  // The site is tied to a user_profiles row, so the user must have at least one.
  const profiles = await getUserProfiles(user.id);

  if (profiles.length === 0) {
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

  // Default: first profile. In the future a profile-switcher could be added.
  const activeProfile = profiles[0];
  const existingConfig = await getSiteConfig(activeProfile.id);

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <div className="border-b border-wine/15">
        <div className="container mx-auto px-4 max-w-4xl py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif mb-1">
                Creator Website
              </p>
              <h1 className="text-2xl font-display font-bold text-ink">
                Your Website
              </h1>
              <p className="text-ink/50 font-serif text-sm mt-1">
                Powered by your Provenance profile —{' '}
                <span className="text-ink/70">{activeProfile.name}</span>
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="font-serif text-ink/60 hover:text-ink shrink-0">
              <Link href="/profile">← Back to profile</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Editor ── */}
      <div className="container mx-auto px-4 max-w-4xl py-10 pb-20">
        {profiles.length > 1 && (
          <div className="mb-8 p-4 rounded-lg bg-wine/5 border border-wine/10">
            <p className="text-xs text-ink/60 font-serif">
              Showing site settings for{' '}
              <strong className="text-ink">{activeProfile.name}</strong> ({activeProfile.role}).{' '}
              Multiple profiles detected — site is linked to the first profile created.
            </p>
          </div>
        )}

        <SiteEditor
          profileId={activeProfile.id}
          initialConfig={existingConfig}
        />
      </div>
    </div>
  );
}
