import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';
import { Card, CardContent } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { getLeadsForArtist } from './_actions/leads';
import { LeadsKanban } from './_components/leads-kanban';

export const metadata = {
  title: 'Leads | Provenance',
  description: 'Track people interested in buying your artwork',
};

export default async function LeadsPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const artistProfile = await getUserProfileByRole(user.id, USER_ROLES.ARTIST);

  if (!artistProfile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold text-wine mb-2">
            Sales leads
          </h1>
          <p className="text-ink/70 font-serif">
            Track people interested in buying your artwork.
          </p>
        </div>
        <Card className="border-wine/20 bg-parchment/60 max-w-xl">
          <CardContent className="p-6">
            <h2 className="font-display text-xl font-bold text-wine mb-2">
              Artist profile required
            </h2>
            <p className="text-ink/70 font-serif text-sm mb-4">
              The leads board is for artists. Create an artist profile from your profiles page, then return here to track interested buyers.
            </p>
            <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
              <Link href="/profiles">Go to Profiles</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [leads, artworksResult] = await Promise.all([
    getLeadsForArtist(),
    (client as any)
      .from('artworks')
      .select('id, title, image_url')
      .eq('account_id', user.id)
      .eq('status', 'verified')
      .order('title'),
  ]);

  const artistArtworks = ((artworksResult.data ?? []) as { id: string; title: string; image_url: string | null }[]).map((a) => ({
    id: a.id,
    title: a.title,
    image_url: a.image_url,
  }));

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Sales leads
        </h1>
        <p className="text-ink/70 font-serif">
          Track people interested in buying your artwork. Four stages: Interested → Contacted → Negotiating → Sold.
        </p>
      </div>

      <LeadsKanban initialLeads={leads} artistArtworks={artistArtworks} />
    </div>
  );
}
