import Link from 'next/link';
import { redirect } from 'next/navigation';

import { formatCents } from '~/lib/auctions/bid-rules';

import { Countdown } from '../_components/countdown';
import { getViewer } from '../_lib/auction-access';
import { getMyBids } from '../_lib/load-auction';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'My bids | Provenance' };

const STATUS: Record<string, { label: string; cls: string }> = {
  leading: { label: 'Leading', cls: 'text-notify-success' },
  outbid: { label: 'Outbid', cls: 'text-wine' },
  won: { label: 'Won', cls: 'text-notify-success' },
  lost: { label: 'Not won', cls: 'text-ink/50' },
};

export default async function MyBidsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/auth/sign-in?next=/auctions/my-bids');
  const rows = await getMyBids(viewer.id);
  const active = rows.filter((r) => r.status === 'leading' || r.status === 'outbid');
  const done = rows.filter((r) => r.status === 'won' || r.status === 'lost');

  return (
    <div className="min-h-screen bg-parchment">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <p className="font-serif text-[11px] uppercase tracking-widest text-wine/60">
          <Link href="/auctions" className="hover:underline">
            Auctions
          </Link>
        </p>
        <h1 className="mt-2 font-display text-3xl text-wine">My bids</h1>
        {rows.length === 0 && (
          <p className="mt-4 font-serif text-sm text-ink/60">
            You haven’t bid yet.{' '}
            <Link href="/auctions" className="text-wine hover:underline">
              Browse live auctions
            </Link>
            .
          </p>
        )}
        {active.length > 0 && <BidList title="Active" rows={active} />}
        {done.length > 0 && <BidList title="Closed" rows={done} />}
      </div>
    </div>
  );
}

function BidList({ title, rows }: { title: string; rows: Awaited<ReturnType<typeof getMyBids>> }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl text-wine">{title}</h2>
      <div className="mt-3 space-y-2">
        {rows.map((r) => {
          const s = r.status ? STATUS[r.status] : null;
          return (
            <Link
              key={r.lotId}
              href={`/auctions/${r.auctionId}`}
              className="flex items-center gap-3 rounded-lg border border-wine/10 bg-white/60 p-3 hover:border-wine/30"
            >
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
              ) : (
                <div className="h-12 w-12 rounded bg-ink/5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-sm text-ink">{r.artworkTitle}</p>
                <p className="truncate font-serif text-xs text-ink/50">
                  {r.auctionTitle} · Lot {r.lotNumber}
                </p>
              </div>
              <div className="text-right font-serif text-xs">
                {s && <p className={`font-medium ${s.cls}`}>{s.label}</p>}
                <p className="text-ink/60">
                  Your bid {formatCents(r.myMaxCents, r.currency)} · high {formatCents(r.currentBidCents, r.currency)}
                </p>
                {(r.status === 'leading' || r.status === 'outbid') && r.endsAt && (
                  <Countdown to={r.endsAt} className="text-ink/50" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
