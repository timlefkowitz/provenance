'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { formatCents } from '~/lib/auctions/bid-rules';

import {
  addLots,
  cancelAuction,
  deleteDraftAuction,
  moveLot,
  publishAuction,
  reviewConsignment,
  updateAuction,
  updateLot,
  withdrawLot,
} from '../_actions/manage-auction';
import type { AuctionableArtwork, AuctionRecord } from '../_lib/auction-access';
import type { AuctionPhase } from '~/lib/auctions/bid-rules';
import type { LotView } from '../_lib/load-auction';

/** ISO → value for <input type="datetime-local"> in the viewer's time zone. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const centsToInput = (c: number | null | undefined) => (c == null ? '' : (c / 100).toString());

export function ManageAuction({
  auction,
  phase,
  lots,
  pending,
  available,
  hasBids,
}: {
  auction: AuctionRecord;
  phase: AuctionPhase;
  lots: LotView[];
  pending: LotView[];
  available: AuctionableArtwork[];
  hasBids: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [title, setTitle] = useState(auction.title);
  const [description, setDescription] = useState(auction.description ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(auction.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(auction.ends_at));
  const [consign, setConsign] = useState(auction.accepts_consignments);
  const [antiSnipe, setAntiSnipe] = useState(String(Math.round(auction.anti_snipe_seconds / 60)));
  const [stagger, setStagger] = useState(String(Math.round(auction.lot_stagger_seconds / 60)));
  const [adding, setAdding] = useState<Record<string, { start: string; reserve: string }>>({});

  const ended = phase === 'closed' || phase === 'cancelled';
  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (r.success) {
        toast.success(ok);
        router.refresh();
      } else toast.error(r.error ?? 'Something went wrong');
    });

  const saveSettings = () =>
    run(
      () =>
        updateAuction(auction.id, {
          title,
          description,
          acceptsConsignments: consign,
          antiSnipeSeconds: Number(antiSnipe || 0) * 60,
          lotStaggerSeconds: Number(stagger || 0) * 60,
          ...(hasBids ? {} : { startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }),
        }),
      'Saved',
    );

  return (
    <div className="space-y-10">
      <section className="rounded-lg border border-wine/10 bg-white/60 p-5">
        <h2 className="font-display text-xl text-wine">Settings</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={ended} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={ended} />
          </div>
          <div>
            <Label htmlFor="starts">Bidding opens</Label>
            <Input id="starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} disabled={ended || hasBids} />
          </div>
          <div>
            <Label htmlFor="ends">First lot closes</Label>
            <Input id="ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} disabled={ended || hasBids} />
          </div>
          <div>
            <Label htmlFor="stagger">Minutes between lot closings</Label>
            <Input id="stagger" inputMode="numeric" value={stagger} onChange={(e) => setStagger(e.target.value)} disabled={ended} />
          </div>
          <div>
            <Label htmlFor="snipe">Extend a lot by (minutes) on a late bid</Label>
            <Input id="snipe" inputMode="numeric" value={antiSnipe} onChange={(e) => setAntiSnipe(e.target.value)} disabled={ended} />
          </div>
          <label className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={consign} onCheckedChange={setConsign} disabled={ended} />
            <span className="font-serif text-sm text-ink">Accept consignments from collectors (you approve each work)</span>
          </label>
        </div>
        {hasBids && <p className="mt-3 font-serif text-xs text-ink/50">Times are locked now that bidding has started.</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={saveSettings} disabled={busy || ended} className="font-serif">
            Save settings
          </Button>
          {phase === 'draft' && (
            <Button
              variant="outline"
              className="font-serif border-wine/40"
              disabled={busy}
              onClick={() => run(() => publishAuction(auction.id), 'Auction published')}
            >
              Publish auction
            </Button>
          )}
          {!ended && !hasBids && phase !== 'draft' && (
            <Button
              variant="ghost"
              className="font-serif text-wine"
              disabled={busy}
              onClick={() => confirm('Cancel this auction? Its works become available again.') && run(() => cancelAuction(auction.id), 'Auction cancelled')}
            >
              Cancel auction
            </Button>
          )}
          {phase === 'draft' && (
            <Button
              variant="ghost"
              className="font-serif text-wine"
              disabled={busy}
              onClick={() =>
                confirm('Delete this draft auction?') &&
                start(async () => {
                  const r = await deleteDraftAuction(auction.id);
                  if (r.success) router.push('/auctions');
                  else toast.error(r.error);
                })
              }
            >
              Delete draft
            </Button>
          )}
        </div>
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-wine">Consignments to review</h2>
          <div className="mt-3 space-y-2">
            {pending.map((lot) => (
              <ConsignmentRow key={lot.id} lot={lot} currency={auction.currency} busy={busy} run={run} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl text-wine">Lots</h2>
        {lots.length === 0 && <p className="mt-2 font-serif text-sm text-ink/60">No lots yet. Add works below.</p>}
        <div className="mt-3 space-y-2">
          {lots.map((lot, i) => (
            <LotRow
              key={lot.id}
              lot={lot}
              currency={auction.currency}
              busy={busy}
              run={run}
              canReorder={phase === 'draft'}
              first={i === 0}
              last={i === lots.length - 1}
            />
          ))}
        </div>
      </section>

      {!ended && (
        <section>
          <h2 className="font-display text-xl text-wine">Add works</h2>
          {available.length === 0 ? (
            <p className="mt-2 font-serif text-sm text-ink/60">No other unsold works available to add.</p>
          ) : (
            <>
              <div className="mt-3 max-h-96 space-y-1.5 overflow-y-auto rounded-md border border-wine/10 bg-white/50 p-2">
                {available.map((w) => {
                  const sel = adding[w.id];
                  return (
                    <div key={w.id} className="flex flex-wrap items-center gap-3 rounded p-1.5 hover:bg-wine/5">
                      <input
                        type="checkbox"
                        className="accent-wine"
                        checked={!!sel}
                        onChange={() =>
                          setAdding((p) => {
                            const n = { ...p };
                            if (n[w.id]) delete n[w.id];
                            else n[w.id] = { start: '', reserve: '' };
                            return n;
                          })
                        }
                        aria-label={`Add ${w.title}`}
                      />
                      <span className="min-w-0 flex-1 truncate font-serif text-sm">
                        {w.title || 'Untitled'}
                        {w.artist_name && <span className="text-ink/50"> · {w.artist_name}</span>}
                      </span>
                      {sel && (
                        <span className="flex gap-2">
                          <Input
                            className="h-8 w-28"
                            placeholder="Start $"
                            value={sel.start}
                            onChange={(e) => setAdding((p) => ({ ...p, [w.id]: { ...sel, start: e.target.value } }))}
                          />
                          <Input
                            className="h-8 w-28"
                            placeholder="Reserve $"
                            value={sel.reserve}
                            onChange={(e) => setAdding((p) => ({ ...p, [w.id]: { ...sel, reserve: e.target.value } }))}
                          />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button
                className="mt-3 font-serif"
                disabled={busy || !Object.keys(adding).length}
                onClick={() =>
                  run(async () => {
                    const r = await addLots(
                      auction.id,
                      Object.entries(adding).map(([artworkId, v]) => ({ artworkId, startPrice: v.start, reserve: v.reserve })),
                    );
                    if (r.success) setAdding({});
                    return r;
                  }, 'Lots added')
                }
              >
                Add {Object.keys(adding).length || ''} selected
              </Button>
            </>
          )}
        </section>
      )}

      <p className="font-serif text-sm">
        <Link href={`/auctions/${auction.id}`} className="text-wine underline-offset-2 hover:underline">
          View the public auction page →
        </Link>
      </p>
    </div>
  );
}

type Run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => void;

function LotRow({
  lot,
  currency,
  busy,
  run,
  canReorder,
  first,
  last,
}: {
  lot: LotView;
  currency: string;
  busy: boolean;
  run: Run;
  canReorder: boolean;
  first: boolean;
  last: boolean;
}) {
  const [startPrice, setStartPrice] = useState(centsToInput(lot.start_price_cents));
  const [reserve, setReserve] = useState(centsToInput(lot.reserve_cents));
  const [increment, setIncrement] = useState(centsToInput(lot.increment_cents));
  const editable = lot.status === 'open';
  const locked = lot.bid_count > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-wine/10 bg-white/60 p-3">
      <span className="w-12 font-serif text-xs uppercase tracking-widest text-wine/60">Lot {lot.lot_number}</span>
      {lot.artwork.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lot.artwork.image_url} alt="" className="h-12 w-12 rounded object-cover" />
      ) : (
        <div className="h-12 w-12 rounded bg-ink/5" />
      )}
      <div className="min-w-[10rem] flex-1">
        <p className="truncate font-serif text-sm text-ink">{lot.artwork.title || 'Untitled'}</p>
        <p className="font-serif text-xs text-ink/50">
          {lot.status === 'sold'
            ? `Sold ${formatCents(lot.current_bid_cents, currency)}${lot.winner_name ? ` to ${lot.winner_name}` : ''}`
            : lot.status === 'passed'
              ? 'Passed'
              : lot.status === 'withdrawn'
                ? 'Withdrawn'
                : lot.current_bid_cents != null
                  ? `${formatCents(lot.current_bid_cents, currency)} · ${lot.bid_count} bids`
                  : 'No bids yet'}
        </p>
      </div>
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-ink/50">
            Start $
            <Input className="h-8 w-24" value={startPrice} onChange={(e) => setStartPrice(e.target.value)} disabled={locked} />
          </label>
          <label className="text-[11px] text-ink/50">
            Reserve $
            <Input className="h-8 w-24" value={reserve} onChange={(e) => setReserve(e.target.value)} placeholder="none" />
          </label>
          <label className="text-[11px] text-ink/50">
            Increment $
            <Input className="h-8 w-24" value={increment} onChange={(e) => setIncrement(e.target.value)} placeholder="auto" />
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  updateLot(lot.id, {
                    ...(locked ? {} : { startPrice }),
                    reserve,
                    increment,
                  }),
                `Lot ${lot.lot_number} saved`,
              )
            }
          >
            Save
          </Button>
          {canReorder && (
            <>
              <Button size="sm" variant="ghost" disabled={busy || first} onClick={() => run(() => moveLot(lot.id, 'up'), 'Moved')} aria-label="Move up">
                ↑
              </Button>
              <Button size="sm" variant="ghost" disabled={busy || last} onClick={() => run(() => moveLot(lot.id, 'down'), 'Moved')} aria-label="Move down">
                ↓
              </Button>
            </>
          )}
          {!locked && (
            <Button size="sm" variant="ghost" className="text-wine" disabled={busy} onClick={() => run(() => withdrawLot(lot.id), 'Lot removed')}>
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ConsignmentRow({ lot, currency, busy, run }: { lot: LotView; currency: string; busy: boolean; run: Run }) {
  const [startPrice, setStartPrice] = useState(centsToInput(lot.start_price_cents));
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-wine/20 bg-wine/5 p-3">
      {lot.artwork.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lot.artwork.image_url} alt="" className="h-12 w-12 rounded object-cover" />
      ) : (
        <div className="h-12 w-12 rounded bg-ink/5" />
      )}
      <div className="min-w-[10rem] flex-1">
        <p className="truncate font-serif text-sm text-ink">{lot.artwork.title || 'Untitled'}</p>
        <p className="font-serif text-xs text-ink/50">
          {lot.artwork.artist_name ?? 'Unknown artist'}
          {lot.reserve_cents != null && ` · consignor's reserve ${formatCents(lot.reserve_cents, currency)}`}
        </p>
      </div>
      <label className="text-[11px] text-ink/50">
        Start $
        <Input className="h-8 w-24" value={startPrice} onChange={(e) => setStartPrice(e.target.value)} />
      </label>
      <Button size="sm" disabled={busy} onClick={() => run(() => reviewConsignment(lot.id, true, { startPrice }), 'Consignment accepted')}>
        Accept
      </Button>
      <Button size="sm" variant="ghost" className="text-wine" disabled={busy} onClick={() => run(() => reviewConsignment(lot.id, false), 'Consignment declined')}>
        Decline
      </Button>
    </div>
  );
}
