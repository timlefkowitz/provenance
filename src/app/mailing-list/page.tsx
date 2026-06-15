import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';
import { getActiveSubscription } from '~/lib/subscription';
import { Card, CardContent } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { ArrowLeft } from 'lucide-react';
import { getLeadsForArtist } from '~/app/portal/or/_actions/leads';
import { MailingListPanel } from './_components/mailing-list-panel';

export const metadata = {
  title: 'Mailing List | Provenance',
  description: 'Your contacts and email outreach list',
};

export default async function MailingListPage() {
  console.log('[CRM] MailingListPage started');
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const artistProfile = await getUserProfileByRole(user.id, USER_ROLES.ARTIST);

  let isOwner = true;
  let needsProfile = false;

  if (!artistProfile) {
    const { data: membership, error: membershipErr } = await (client as any)
      .from('crm_members')
      .select('artist_user_id')
      .eq('member_user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (membershipErr) {
      console.error('[CRM] MailingListPage crm_members lookup failed', membershipErr);
    }

    if (!membership?.artist_user_id) {
      needsProfile = true;
    } else {
      isOwner = false;
    }
  }

  if (!needsProfile && isOwner) {
    const artistSubscription = await getActiveSubscription(user.id);
    if (!artistSubscription) {
      redirect('/subscription?upgrade=1');
    }
  }

  const header = (
    <div className="border-b border-wine/15">
      <div className="container mx-auto px-4 max-w-7xl py-10 md:py-12">
        <Link
          href="/portal/or"
          className="inline-flex items-center gap-1.5 text-xs font-serif text-wine/60 hover:text-wine mb-4 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to CRM
        </Link>
        <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">Toolbox</p>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-ink mb-2">
          Mailing List
        </h1>
        <p className="text-ink/50 font-serif text-sm max-w-xl">
          Everyone you meet through exhibitions, certificate sends, and sales — plus anyone you add manually. Shared with your CRM contacts.
        </p>
      </div>
    </div>
  );

  if (needsProfile) {
    return (
      <div className="min-h-screen">
        {header}
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          <Card className="border-wine/20 bg-parchment/60 max-w-xl">
            <CardContent className="p-6">
              <h2 className="font-display text-xl font-bold text-wine mb-2">
                Artist profile required
              </h2>
              <p className="text-ink/70 font-serif text-sm mb-4">
                The mailing list is for artists. Create an artist profile, then return here to manage your contacts.
              </p>
              <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
                <Link href="/profiles">Go to Profiles</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const contacts = await getLeadsForArtist();
  console.log('[CRM] MailingListPage ready', { contacts: contacts.length });

  return (
    <div className="min-h-screen">
      {header}
      <div className="container mx-auto px-4 max-w-7xl py-8 pb-24">
        <MailingListPanel initialContacts={contacts} />
      </div>
    </div>
  );
}
