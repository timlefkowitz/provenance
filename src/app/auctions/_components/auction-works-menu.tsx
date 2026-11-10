'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gavel } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';

import { consignArtworks, getAuctionsAcceptingConsignments } from '../_actions/consign';

type OpenAuction = Awaited<ReturnType<typeof getAuctionsAcceptingConsignments>>[number];

/**
 * Collection page action for the selected works: start a new auction with
 * them, or consign them into a gallery's auction that is taking consignments.
 */
export function AuctionWorksMenu({ artworkIds }: { artworkIds: string[] }) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [auctions, setAuctions] = useState<OpenAuction[] | null>(null);
  const [pending, start] = useTransition();
  const count = artworkIds.length;

  const openPicker = () => {
    setPickerOpen(true);
    if (auctions == null) start(async () => setAuctions(await getAuctionsAcceptingConsignments()));
  };

  const consign = (auction: OpenAuction) =>
    start(async () => {
      const r = await consignArtworks(
        auction.id,
        artworkIds.map((artworkId) => ({ artworkId })),
      );
      if (r.success) {
        toast.success(`Sent ${r.submitted} ${r.submitted === 1 ? 'work' : 'works'} to ${auction.title} for approval`);
        setPickerOpen(false);
        router.push(`/auctions/${auction.id}`);
      } else toast.error(r.error);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-10 px-4 font-serif text-sm border-wine/30 bg-parchment/40 text-ink hover:bg-wine/10 hover:text-ink"
          >
            <Gavel className="h-4 w-4 mr-1.5" aria-hidden />
            Auction{count ? ` (${count})` : ''}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            onSelect={() => router.push(count ? `/auctions/new?artworks=${artworkIds.slice(0, 100).join(',')}` : '/auctions/new')}
          >
            {count ? `New auction with ${count} selected` : 'New auction'}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!count} onSelect={openPicker}>
            Consign selected to an auction…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-wine">Consign {count} {count === 1 ? 'work' : 'works'}</DialogTitle>
            <DialogDescription className="font-serif">
              These auctions are taking consignments. The organizer reviews your works and sets their start price.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {auctions == null && <p className="font-serif text-sm text-ink/60">Loading auctions…</p>}
            {auctions?.length === 0 && (
              <p className="font-serif text-sm text-ink/60">No auctions are taking consignments right now.</p>
            )}
            {auctions?.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={pending}
                onClick={() => consign(a)}
                className="flex w-full items-center justify-between rounded-md border border-wine/15 p-3 text-left hover:bg-wine/5 disabled:opacity-50"
              >
                <span className="font-serif text-sm text-ink">{a.title}</span>
                <span className="font-serif text-xs text-ink/50">closes {new Date(a.ends_at).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
