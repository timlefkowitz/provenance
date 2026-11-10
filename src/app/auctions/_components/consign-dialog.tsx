'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import { consignArtworks, getConsignableArtworks } from '../_actions/consign';

type Work = Awaited<ReturnType<typeof getConsignableArtworks>>[number];

/** Pick works you hold and send them to the organizer for approval. */
export function ConsignDialog({ auctionId, auctionTitle }: { auctionId: string; auctionTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [works, setWorks] = useState<Work[] | null>(null);
  const [picked, setPicked] = useState<Record<string, { start: string; reserve: string }>>({});
  const [pending, start] = useTransition();

  const onOpen = (next: boolean) => {
    setOpen(next);
    if (next && works == null) {
      start(async () => setWorks(await getConsignableArtworks()));
    }
  };

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = { ...p };
      if (n[id]) delete n[id];
      else n[id] = { start: '', reserve: '' };
      return n;
    });

  const submit = () =>
    start(async () => {
      const items = Object.entries(picked).map(([artworkId, v]) => ({ artworkId, startPrice: v.start, reserve: v.reserve }));
      const res = await consignArtworks(auctionId, items);
      if (res.success) {
        toast.success(`Sent ${res.submitted} ${res.submitted === 1 ? 'work' : 'works'} to the organizer for approval`);
        setOpen(false);
        setPicked({});
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="font-serif border-wine/30">
          Consign a work
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">Consign to {auctionTitle}</DialogTitle>
          <DialogDescription className="font-serif">
            Choose works from your collection. The organizer reviews each one before it goes on offer. Set a start
            price and an optional reserve (the lowest price you’ll accept).
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {works == null && <p className="font-serif text-sm text-ink/60">Loading your works…</p>}
          {works?.length === 0 && (
            <p className="font-serif text-sm text-ink/60">You have no unsold works available to consign.</p>
          )}
          {works?.map((w) => {
            const sel = picked[w.id];
            return (
              <div key={w.id} className="rounded-md border border-wine/10 p-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={!!sel} onChange={() => toggle(w.id)} className="accent-wine" />
                  {w.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-ink/5" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-sm text-ink">{w.title || 'Untitled'}</span>
                    {w.artist_name && <span className="block truncate text-xs text-ink/50">{w.artist_name}</span>}
                  </span>
                </label>
                {sel && (
                  <div className="mt-2 grid grid-cols-2 gap-2 pl-7">
                    <Input
                      placeholder="Start price ($)"
                      inputMode="decimal"
                      value={sel.start}
                      onChange={(e) => setPicked((p) => ({ ...p, [w.id]: { ...sel, start: e.target.value } }))}
                    />
                    <Input
                      placeholder="Reserve ($, optional)"
                      inputMode="decimal"
                      value={sel.reserve}
                      onChange={(e) => setPicked((p) => ({ ...p, [w.id]: { ...sel, reserve: e.target.value } }))}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !Object.keys(picked).length} className="font-serif">
            {pending ? 'Sending…' : 'Submit for approval'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
