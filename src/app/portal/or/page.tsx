import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';
import { getActiveSubscription } from '~/lib/subscription';
import { Card, CardContent } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { getLeadsForArtist } from './_actions/leads';
import { getCrmMembers, getCrmColumnLabels } from './_actions/crm-members';
import { CrmWorkspace } from './_components/crm-workspace';

export const metadata = {
  title: 'Opportunities & Relationships | Provenance',
  description: 'Track opportunities of interest',
};

export default async function OpportunitiesPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const artistProfile = await getUserProfileByRole(user.id, USER_ROLES.ARTIST);

  // Determine access: own artist profile or CRM team member
  let isOwner = true;
  let ownerUserId = user.id;

  if (!artistProfile) {
    const { data: membership } = await (client as any)
      .from('crm_members')
      .select('artist_user_id')
      .eq('member_user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.artist_user_id) {
      return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="mb-8">
            <h1 className="text-4xl font-display font-bold text-wine mb-2">
              Opportunities and Relationships
            </h1>
            <p className="text-ink/70 font-serif">
              Track opportunities of interest.
            </p>
          </div>
          <Card className="border-wine/20 bg-parchment/60 max-w-xl">
            <CardContent className="p-6">
              <h2 className="font-display text-xl font-bold text-wine mb-2">
                Artist profile required
              </h2>
              <p className="text-ink/70 font-serif text-sm mb-4">
                The opportunities board is for artists. Create an artist profile from your profiles page, then return here to track opportunities.
              </p>
              <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
                <Link href="/profiles">Go to Profiles</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    isOwner = false;
    ownerUserId = membership.artist_user_id;
  }

  // Owners must have an active subscription; team members borrow the owner's access
  if (isOwner) {
    const artistSubscription = await getActiveSubscription(user.id);
    if (!artistSubscription) {
      redirect('/subscription?upgrade=1');
    }
  }

  const [leads, artworksResult, initialCrmMembers, initialColumnLabels] = await Promise.all([
    getLeadsForArtist(),
    (client as any)
      .from('artworks')
      .select('id, title, image_url')
      .eq('account_id', ownerUserId)
      .eq('status', 'verified')
      .order('title'),
    isOwner ? getCrmMembers() : Promise.resolve([]),
    getCrmColumnLabels(),
  ]);

  const artistArtworks = ((artworksResult.data ?? []) as { id: string; title: string; image_url: string | null }[]).map((a) => ({
    id: a.id,
    title: a.title,
    image_url: a.image_url,
  }));

  return (
    <div className="min-h-screen">
      {/* Editorial header */}
      <div className="border-b border-wine/15">
        <div className="container mx-auto px-4 max-w-7xl py-10 md:py-12">
          <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">Toolbox</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-ink mb-2">
            CRM
          </h1>
          <p className="text-ink/50 font-serif text-sm max-w-lg">
            Track collector and buyer relationships across four stages: Interested → Contacted → Negotiating → Sold.
          </p>
        </div>
      </div>

      <CrmWorkspace
        initialLeads={leads}
        artistArtworks={artistArtworks}
        isOwner={isOwner}
        initialCrmMembers={initialCrmMembers}
        initialColumnLabels={initialColumnLabels}
      />
    </div>
  );
}
