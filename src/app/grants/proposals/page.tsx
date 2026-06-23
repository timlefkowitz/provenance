import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';
import { getActiveSubscription } from '~/lib/subscription';
import { getProposals } from '../_actions/get-proposals';
import { UpgradePrompt } from '~/components/upgrade-prompt';
import { Card, CardContent } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import {
  FileText,
  ChevronRight,
  Clock,
  ArrowLeft,
  PlusCircle,
} from 'lucide-react';

export const metadata = {
  title: 'My Proposals | Grants | Provenance',
  description: 'Your AI-drafted grant proposals',
};

function statusBadge(status: string) {
  const map: Record<string, { label: string; classes: string }> = {
    draft: { label: 'Draft', classes: 'bg-wine/10 text-wine/70' },
    in_progress: { label: 'In progress', classes: 'bg-amber-50 text-amber-700' },
    submitted: { label: 'Submitted', classes: 'bg-emerald-50 text-emerald-700' },
  };
  const entry = map[status] ?? { label: status, classes: 'bg-ink/10 text-ink/60' };
  return (
    <span
      className={`text-[11px] font-sans font-semibold uppercase tracking-widest rounded-full px-2.5 py-0.5 ${entry.classes}`}
    >
      {entry.label}
    </span>
  );
}

export default async function ProposalsPage() {
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
            href="/grants"
            className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-wine font-serif transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Grants
          </Link>
        </div>
        <UpgradePrompt
          featureName="Grant Proposals"
          description="Draft, edit, and save grant proposals with AI — tailored to your practice."
          ctaHref="/subscription?upgrade=1"
          source="proposals_page"
        />
      </div>
    );
  }

  const proposals = await getProposals();
  console.log('[Proposals] page: loaded', proposals.length);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/grants"
          className="inline-flex items-center gap-1.5 text-sm text-ink/55 hover:text-wine font-serif transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Grants
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-wine mb-1">My Proposals</h1>
            <p className="text-ink/60 font-serif text-sm">
              AI-drafted applications you can refine and submit.
            </p>
          </div>
          <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif gap-1.5">
            <Link href="/grants">
              <PlusCircle className="h-4 w-4" />
              New proposal
            </Link>
          </Button>
        </div>
      </div>

      {/* List */}
      {proposals.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-wine/15 rounded-2xl">
          <FileText className="h-10 w-10 text-wine/25 mx-auto mb-4" />
          <h2 className="font-display text-lg text-wine/60 mb-2">No proposals yet</h2>
          <p className="font-serif text-sm text-ink/50 max-w-sm mx-auto mb-6">
            Ask Taco to draft a proposal for any grant and it will appear here ready to edit.
          </p>
          <Button asChild variant="outline" className="font-serif border-wine/30 text-wine">
            <Link href="/grants">Go to Grants</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal) => (
            <Link key={proposal.id} href={`/grants/proposals/${proposal.id}`}>
              <Card className="group border-wine/15 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                <CardContent className="p-0">
                  <div className="h-0.5 w-full bg-gradient-to-r from-wine/40 to-wine rounded-t-xl" />
                  <div className="p-5 flex items-center gap-4">
                    <div className="shrink-0 h-10 w-10 rounded-xl bg-wine/8 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-wine/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-wine text-base leading-snug truncate">
                        {proposal.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        {proposal.grant_name && (
                          <span className="text-xs font-serif text-ink/50 truncate max-w-[200px]">
                            {proposal.grant_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs font-serif text-ink/40">
                          <Clock className="h-3 w-3" />
                          {new Date(proposal.updated_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {statusBadge(proposal.status)}
                      <ChevronRight className="h-4 w-4 text-ink/30 group-hover:text-wine transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
