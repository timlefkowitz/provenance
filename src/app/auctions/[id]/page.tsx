import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@kit/ui/button';

import { SoldDot } from '~/components/sold-dot';
import { formatCents } from '~/lib/auctions/bid-rules';

import { AuctionPoller } from '../_components/auction-poller';
import { ConsignDialog } from '../_components/consign-dialog';
import { Countdown } from '../_components/countdown';
import { LotBidPanel } from '../_components/lot-bid-panel';
import { loadAuction } from '../_lib/auction-access';
import { getAuctionView, type LotView } from '../_lib/load-auction';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auction = await loadAuction(id).catch(() => null);
  const isPublic = auction && auction.status !== 'draft' && auction.published_at;
  return { title: isPublic ? `${auction.title} | Auction | Provenance` : 'Auction | Provenance' };
}

const PHASE_LABEL: Record<string, string> = {
  draft: 'Draft',
  upcoming: 'Upcoming',
  live: 'Live',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getAuctionView(id);
  if (!view) notFound();

  const { auction, phase, lots, canManage, viewerId, exhibition, viewerConsignments } = view;
  const live = phase === 'live';
  const currency = auction.currency;
  const soldCount = lots.filter((l) => l.status === 'sold').length;
  const totalSold = lots.filter((l) => l.status === 'sold').reduce((s, l) => s + (l.current_bid_cents ?? 0), 0);

  return (
    <div className="min-h-screen bg-parchment">
      <AuctionPoller active={live || phase === 'upcoming'} intervalMs={live ? 5000 : 30000} />
      <div className="border-b border-wine/15">
        <div className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
          <div className="flex flex-wrap items-center gap-2 font-serif text-[11px] uppercase tracking-widest text-wine/60">
            <span
              className={`rounded-full px-2 py-0.5 ${live ? 'bg-wine text-parchment' : 'bg-wine/10 text-wine'}`}
            >
              {PHASE_LABEL[phase]}
            </span>
            <span>Auction · {view.organizerName}</span>
          </div>
          <h1 className="mt-3 font-display text-3xl text-wine sm:text-4xl">{auction.title}</h1>
          {exhibition && (
            <p className="mt-1 font-serif text-sm text-ink/60">
              From the exhibition{' '}
              <Link href={`/exhibitions/${exhibition.id}`} className="text-wine underline-offset-2 hover:underline">
                {exhibition.title}
              </Link>
            </p>
          )}
          {auction.description && (
            <p className="mt-4 max-w-2xl whitespace-pre-line font-serif text-sm text-ink/75">{auction.description}</p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-serif text-sm text-ink/70">
            {phase === 'upcoming' && <Countdown to={auction.starts_at} prefix="Bidding opens in" endedLabel="Opening…" />}
            {live && (
              <span>
                First lot closes {fmtDate(auction.ends_at)}; lots close {Math.round(auction.lot_stagger_seconds / 60) || 0}{' '}
                min apart
              </span>
            )}
            {phase === 'closed' && (
              <span>
                {soldCount} of {lots.length} lots sold{soldCount ? ` · ${formatCents(totalSold, currency)} total` : ''}
              </span>
            )}
            <span>{lots.length} lots</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {canManage && (
              <Link href={`/auctions/${auction.id}/manage`}>
                <Button className="font-serif">Manage auction</Button>
              </Link>
            )}
            {!canManage && viewerId && auction.accepts_consignments && (live || phase === 'upcoming') && (
              <ConsignDialog auctionId={auction.id} auctionTitle={auction.title} />
            )}
            {viewerId && (
              <Link href="/auctions/my-bids">
                <Button variant="ghost" className="font-serif text-wine">
                  My bids
                </Button>
              </Link>
            )}
          </div>
          {viewerConsignments.length > 0 && (
            <div className="mt-5 rounded-md border border-wine/15 bg-white/50 p-3 font-serif text-sm">
              <p className="text-ink/70">Your consignments:</p>
              <ul className="mt-1 space-y-0.5">
                {viewerConsignments.map((c) => (
                  <li key={c.id} className="text-ink/80">
                    “{c.artwork.title}” — {c.status === 'pending' ? 'awaiting the organizer’s review' : 'declined'}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {phase === 'draft' && canManage && (
            <p className="mt-5 font-serif text-sm text-wine">
              This auction is a draft and only your team can see it. Publish it from Manage auction.
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-10">
        {lots.length === 0 ? (
          <p className="font-serif text-ink/60">No lots yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {lots.map((lot) => (
              <LotCard
                key={lot.id}
                lot={lot}
                auctionId={auction.id}
                currency={currency}
                signedIn={!!viewerId}
                biddingOpen={live && lot.status === 'open'}
                upcoming={phase === 'upcoming'}
              />
            ))}
          </div>
        )}
        <p className="mt-10 max-w-2xl font-serif text-xs text-ink/50">
          Bids are binding. When a lot closes at or above its reserve, the high bidder wins and the seller contacts
          them to arrange payment and delivery; ownership is recorded on Provenance with a Certificate of Ownership.
          A bid in the last {Math.round(auction.anti_snipe_seconds / 60) || 0} minutes extends that lot’s closing time.
        </p>
      </div>
    </div>
  );
}

function LotCard({
  lot,
  auctionId,
  currency,
  signedIn,
  biddingOpen,
  upcoming,
}: {
  lot: LotView;
  auctionId: string;
  currency: string;
  signedIn: boolean;
  biddingOpen: boolean;
  upcoming: boolean;
}) {
  const a = lot.artwork;
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-wine/10 bg-white/60">
      <Link href={`/artworks/${a.id}/certificate`} className="relative block aspect-[4/3] bg-ink/5">
        {a.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image_url} alt={a.title} className="h-full w-full object-contain" loading="lazy" />
        )}
        {lot.status === 'sold' && <SoldDot variant="overlay" />}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="font-serif text-[11px] uppercase tracking-widest text-wine/60">Lot {lot.lot_number}</p>
          <h2 className="font-display text-lg leading-snug text-ink">{a.title || 'Untitled'}</h2>
          <p className="font-serif text-sm text-ink/60">
            {[a.artist_name, a.creation_date?.slice(0, 4), a.medium].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="font-serif text-sm">
          {lot.status === 'sold' ? (
            <p className="text-ink">
              Sold for <span className="font-medium">{formatCents(lot.current_bid_cents, currency)}</span>
              {lot.viewer_status === 'won' && <span className="ml-2 text-notify-success">You won</span>}
              {lot.winner_name && <span className="block text-xs text-ink/60">to {lot.winner_name}</span>}
            </p>
          ) : lot.status === 'passed' ? (
            <p className="text-ink/60">Passed{lot.bid_count ? ' (reserve not met)' : ' (no bids)'}</p>
          ) : lot.status === 'withdrawn' ? (
            <p className="text-ink/60">Withdrawn</p>
          ) : (
            <>
              <p className="text-ink">
                {lot.current_bid_cents != null ? (
                  <>
                    Current bid <span className="font-medium">{formatCents(lot.current_bid_cents, currency)}</span>
                    <span className="text-ink/50">
                      {' '}
                      · {lot.bid_count} {lot.bid_count === 1 ? 'bid' : 'bids'}
                    </span>
                  </>
                ) : (
                  <>
                    Starting bid <span className="font-medium">{formatCents(lot.next_min_cents, currency)}</span>
                  </>
                )}
              </p>
              {lot.reserve_status === 'not_met' && lot.current_bid_cents != null && (
                <p className="text-xs text-wine/80">Reserve not met</p>
              )}
              {lot.reserve_status === 'met' && <p className="text-xs text-notify-success">Reserve met</p>}
              {lot.viewer_is_seller && lot.reserve_cents != null && (
                <p className="text-xs text-ink/50">Your reserve: {formatCents(lot.reserve_cents, currency)}</p>
              )}
              {lot.ends_at && !upcoming && <Countdown to={lot.ends_at} className="block text-xs text-ink/60" />}
            </>
          )}
        </div>

        <div className="mt-auto">
          <LotBidPanel
            key={lot.next_min_cents}
            lotId={lot.id}
            auctionId={auctionId}
            nextMinCents={lot.next_min_cents}
            currency={currency}
            signedIn={signedIn}
            isSeller={lot.viewer_is_seller}
            viewerStatus={lot.viewer_status}
            biddingOpen={biddingOpen}
          />
        </div>

        {lot.history.length > 0 && (
          <details className="font-serif text-xs text-ink/60">
            <summary className="cursor-pointer text-ink/50">Bid history</summary>
            <ul className="mt-1 space-y-0.5">
              {lot.history.map((h, i) => (
                <li key={i} className="flex justify-between">
                  <span>{h.label}</span>
                  <span>{formatCents(h.amount_cents, currency)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}
