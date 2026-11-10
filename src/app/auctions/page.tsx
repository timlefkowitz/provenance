import Link from 'next/link';

import { Button } from '@kit/ui/button';

import { SiteLegalFooter } from '~/components/legal/site-legal-footer';

import { Countdown } from './_components/countdown';
import { getViewer } from './_lib/auction-access';
import { listAuctions, type AuctionCard } from './_lib/load-auction';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Auctions | Provenance',
  description: 'Timed online art auctions from galleries, institutions and collectors on Provenance.',
};

export default async function AuctionsPage() {
  const [viewer, { cards, mine }] = await Promise.all([getViewer(), listAuctions()]);
  const live = cards.filter((c) => c.phase === 'live').sort((a, b) => a.ends_at.localeCompare(b.ends_at));
  const upcoming = cards.filter((c) => c.phase === 'upcoming').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = cards.filter((c) => c.phase === 'closed').slice(0, 24);
  const myOpen = mine.filter((m) => m.phase === 'draft' || m.phase === 'live' || m.phase === 'upcoming');

  return (
    <div className="min-h-screen bg-parchment">
      <div className="border-b border-wine/15">
        <div className="container mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-10 md:py-14">
          <div>
            <h1 className="font-display text-3xl text-wine sm:text-4xl">Auctions</h1>
            <p className="mt-2 max-w-xl font-serif text-sm text-ink/65">
              Timed online auctions of verified works. Every sale is recorded on the work’s provenance.
            </p>
          </div>
          {viewer && (
            <div className="flex gap-2">
              <Link href="/auctions/my-bids">
                <Button variant="ghost" className="font-serif text-wine">
                  My bids
                </Button>
              </Link>
              <Link href="/auctions/new">
                <Button className="font-serif">New auction</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-6xl space-y-12 px-4 py-10">
        {myOpen.length > 0 && <Section title="Your auctions" cards={myOpen} manage />}
        <Section title="Live now" cards={live} empty="No auctions are live right now." />
        {upcoming.length > 0 && <Section title="Upcoming" cards={upcoming} />}
        {past.length > 0 && <Section title="Past auctions" cards={past} />}
      </div>
      <SiteLegalFooter />
    </div>
  );
}

function Section({ title, cards, empty, manage }: { title: string; cards: AuctionCard[]; empty?: string; manage?: boolean }) {
  return (
    <section>
      <h2 className="font-display text-2xl text-wine">{title}</h2>
      {cards.length === 0 ? (
        <p className="mt-3 font-serif text-sm text-ink/60">{empty}</p>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={c.id}
              href={manage && c.phase === 'draft' ? `/auctions/${c.id}/manage` : `/auctions/${c.id}`}
              className="group overflow-hidden rounded-lg border border-wine/10 bg-white/60 transition hover:border-wine/30"
            >
              <div className="aspect-[16/10] bg-ink/5">
                {c.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="p-4">
                <p className="font-serif text-[11px] uppercase tracking-widest text-wine/60">
                  {c.phase === 'draft' ? 'Draft' : c.organizerName}
                </p>
                <h3 className="font-display text-lg text-ink group-hover:text-wine">{c.title}</h3>
                <p className="mt-1 font-serif text-xs text-ink/60">
                  {c.lotCount} {c.lotCount === 1 ? 'lot' : 'lots'}
                  {c.accepts_consignments && c.phase !== 'closed' ? ' · taking consignments' : ''}
                </p>
                <p className="mt-1 font-serif text-xs text-ink/60">
                  {c.phase === 'live' && <Countdown to={c.ends_at} prefix="First lot closes in" endedLabel="Lots closing" />}
                  {c.phase === 'upcoming' && <Countdown to={c.starts_at} prefix="Opens in" endedLabel="Opening…" />}
                  {c.phase === 'closed' && `Closed ${new Date(c.lastLotEndsAt ?? c.ends_at).toLocaleDateString()}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
