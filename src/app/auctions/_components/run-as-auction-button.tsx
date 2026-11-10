'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gavel } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { createAuctionFromExhibition } from '../_actions/create-auction';

const cls = 'font-serif text-ink/40 hover:text-wine h-8 gap-1.5';

/** On an exhibition the viewer manages: open its auction, or turn the show into one. */
export function RunAsAuctionButton({ exhibitionId, auctionId }: { exhibitionId: string; auctionId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (auctionId) {
    return (
      <Button asChild variant="ghost" size="sm" className={cls}>
        <Link href={`/auctions/${auctionId}/manage`}>
          <Gavel className="h-3.5 w-3.5" />
          Auction
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cls}
      disabled={pending}
      onClick={() => {
        if (!confirm('Turn this exhibition into an auction? We’ll create a draft with one lot per unsold work, which you can review before publishing.')) return;
        start(async () => {
          const r = await createAuctionFromExhibition(exhibitionId);
          if (r.success) router.push(`/auctions/${r.auctionId}/manage`);
          else toast.error(r.error);
        });
      }}
    >
      <Gavel className="h-3.5 w-3.5" />
      {pending ? 'Creating…' : 'Run as auction'}
    </Button>
  );
}
