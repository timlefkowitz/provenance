import { redirect, notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';
import { getActiveSubscription } from '~/lib/subscription';
import { getProposal } from '../../_actions/get-proposals';
import { ProposalPageClient } from './_components/proposal-page-client';
import { UpgradePrompt } from '~/components/upgrade-prompt';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const proposal = await getProposal(id);
  return {
    title: proposal ? `${proposal.title} | Proposals | Provenance` : 'Proposal | Provenance',
  };
}

export default async function ProposalPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const artistProfile = await getUserProfileByRole(user.id, USER_ROLES.ARTIST);
  if (!artistProfile) {
    redirect('/grants');
  }

  const artistSubscription = await getActiveSubscription(user.id);
  if (!artistSubscription) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link
            href="/grants/proposals"
            className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-wine font-serif transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            My Proposals
          </Link>
        </div>
        <UpgradePrompt
          featureName="Grant Proposals"
          description="Edit and refine your AI-drafted grant proposals."
          ctaHref="/subscription?upgrade=1"
          source="proposal_editor_page"
        />
      </div>
    );
  }

  const proposal = await getProposal(id);

  if (!proposal) {
    console.log('[Proposals] page: proposal not found or not owned', id);
    notFound();
  }

  console.log('[Proposals] page: loaded proposal', id);
  return <ProposalPageClient proposal={proposal} />;
}
