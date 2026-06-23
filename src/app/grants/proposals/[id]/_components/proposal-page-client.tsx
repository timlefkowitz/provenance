'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { toast } from 'sonner';
import { ProposalEditor } from '~/app/grants/_components/proposal-editor';
import { deleteProposal } from '~/app/grants/_actions/delete-proposal';
import type { ProposalRow } from '~/app/grants/_actions/get-proposals';

type ProposalPageClientProps = {
  proposal: ProposalRow;
};

export function ProposalPageClient({ proposal }: ProposalPageClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState(proposal.title);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        'Delete this proposal? This cannot be undone.',
      )
    )
      return;

    setDeleting(true);
    const { success, error } = await deleteProposal(proposal.id);
    if (success) {
      toast.success('Proposal deleted');
      router.push('/grants/proposals');
    } else {
      setDeleting(false);
      toast.error(error || 'Failed to delete proposal');
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-parchment/30">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-wine/10 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <Link
          href="/grants/proposals"
          className="inline-flex items-center gap-1.5 text-sm text-ink/55 hover:text-wine font-serif transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          My Proposals
        </Link>

        <div className="flex items-center gap-2">
          {proposal.grant_name && (
            <span className="hidden sm:block text-xs font-serif text-ink/40 max-w-[200px] truncate">
              For: {proposal.grant_name}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-600 hover:bg-red-50 font-serif gap-1.5"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </header>

      {/* Editor surface */}
      <main className="flex-1 max-w-3xl w-full mx-auto bg-white shadow-sm border-x border-wine/8 min-h-screen">
        <ProposalEditor
          proposalId={proposal.id}
          initialContent={proposal.content_json ?? undefined}
          initialTitle={title}
          onTitleChange={setTitle}
        />
      </main>
    </div>
  );
}
