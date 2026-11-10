'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { createAuction } from '../_actions/create-auction';
import type { AuctionableArtwork } from '../_lib/auction-access';

function localInput(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewAuctionForm({
  artworks,
  preselected,
  organizers,
}: {
  artworks: AuctionableArtwork[];
  preselected: string[];
  organizers: Array<{ accountId: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const defaults = useMemo(() => {
    const s = new Date();
    s.setMinutes(0, 0, 0);
    s.setHours(s.getHours() + 1);
    const e = new Date(s.getTime() + 7 * 24 * 3600 * 1000);
    return { s: localInput(s), e: localInput(e) };
  }, []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(defaults.s);
  const [endsAt, setEndsAt] = useState(defaults.e);
  const [organizer, setOrganizer] = useState(organizers[0]?.accountId ?? '');
  const [consign, setConsign] = useState(false);
  const [picked, setPicked] = useState<Record<string, { start: string; reserve: string }>>(() =>
    Object.fromEntries(preselected.filter((id) => artworks.some((a) => a.id === id)).map((id) => [id, { start: '', reserve: '' }])),
  );
  const [filter, setFilter] = useState('');

  const shown = artworks.filter((a) =>
    `${a.title} ${a.artist_name ?? ''}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  const submit = () =>
    start(async () => {
      const res = await createAuction({
        title,
        description,
        organizerAccountId: organizer,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        acceptsConsignments: consign,
        lots: Object.entries(picked).map(([artworkId, v]) => ({ artworkId, startPrice: v.start, reserve: v.reserve })),
      });
      if (res.success) {
        toast.success('Draft auction created. Review the lots, then publish.');
        router.push(`/auctions/${res.auctionId}/manage`);
      } else toast.error(res.error);
    });

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="t">Title</Label>
          <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Winter collection sale" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="d">Description</Label>
          <Textarea id="d" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {organizers.length > 1 && (
          <div className="sm:col-span-2">
            <Label htmlFor="org">Run as</Label>
            <select
              id="org"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {organizers.map((o) => (
                <option key={o.accountId} value={o.accountId}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label htmlFor="s">Bidding opens</Label>
          <Input id="s" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="e">First lot closes</Label>
          <Input id="e" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <label className="flex items-center gap-3 sm:col-span-2">
          <Switch checked={consign} onCheckedChange={setConsign} />
          <span className="font-serif text-sm text-ink">Accept consignments from other collectors</span>
        </label>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-xl text-wine">Works to offer</h2>
          <Input className="w-56" placeholder="Filter your works" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <p className="mt-1 font-serif text-xs text-ink/50">
          Start price is the opening bid. A reserve is the lowest price you’ll accept; bidders only see whether it’s met.
        </p>
        {artworks.length === 0 ? (
          <p className="mt-3 font-serif text-sm text-ink/60">
            You have no unsold works to auction yet. You can still create the auction and accept consignments.
          </p>
        ) : (
          <div className="mt-3 max-h-[28rem] space-y-1.5 overflow-y-auto rounded-md border border-wine/10 bg-white/50 p-2">
            {shown.map((w) => {
              const sel = picked[w.id];
              return (
                <div key={w.id} className="flex flex-wrap items-center gap-3 rounded p-1.5 hover:bg-wine/5">
                  <input
                    type="checkbox"
                    className="accent-wine"
                    checked={!!sel}
                    aria-label={`Include ${w.title}`}
                    onChange={() =>
                      setPicked((p) => {
                        const n = { ...p };
                        if (n[w.id]) delete n[w.id];
                        else n[w.id] = { start: '', reserve: '' };
                        return n;
                      })
                    }
                  />
                  {w.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-ink/5" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-serif text-sm">
                    {w.title || 'Untitled'}
                    {w.artist_name && <span className="text-ink/50"> · {w.artist_name}</span>}
                  </span>
                  {sel && (
                    <span className="flex gap-2">
                      <Input
                        className="h-8 w-28"
                        placeholder="Start $"
                        inputMode="decimal"
                        value={sel.start}
                        onChange={(e) => setPicked((p) => ({ ...p, [w.id]: { ...sel, start: e.target.value } }))}
                      />
                      <Input
                        className="h-8 w-28"
                        placeholder="Reserve $"
                        inputMode="decimal"
                        value={sel.reserve}
                        onChange={(e) => setPicked((p) => ({ ...p, [w.id]: { ...sel, reserve: e.target.value } }))}
                      />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Button onClick={submit} disabled={pending || !title.trim()} className="font-serif">
        {pending ? 'Creating…' : `Create draft auction${Object.keys(picked).length ? ` with ${Object.keys(picked).length} lots` : ''}`}
      </Button>
    </div>
  );
}
