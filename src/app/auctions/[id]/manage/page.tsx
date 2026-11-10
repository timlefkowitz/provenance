import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ManageAuction } from '../../_components/manage-auction';
import { getViewer, loadAuctionableArtworks } from '../../_lib/auction-access';
import { getAuctionView } from '../../_lib/load-auction';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Manage auction | Provenance' };

export default async function ManageAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth/sign-in?next=/auctions/${id}/manage`);

  const view = await getAuctionView(id);
  if (!view) notFound();
  if (!view.canManage) redirect(`/auctions/${id}`);

  const lotArtworkIds = new Set([...view.lots, ...view.pendingConsignments].map((l) => l.artwork.id));
  const available = (await loadAuctionableArtworks(viewer.id)).filter((a) => !lotArtworkIds.has(a.id));
  const hasBids = view.lots.some((l) => l.bid_count > 0);

  return (
    <div className="min-h-screen bg-parchment">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <p className="font-serif text-[11px] uppercase tracking-widest text-wine/60">
          <Link href="/auctions" className="hover:underline">
            Auctions
          </Link>{' '}
          · Manage
        </p>
        <h1 className="mt-2 font-display text-3xl text-wine">{view.auction.title}</h1>
        {view.exhibition && (
          <p className="mt-1 font-serif text-sm text-ink/60">
            Running the exhibition{' '}
            <Link href={`/exhibitions/${view.exhibition.id}`} className="text-wine hover:underline">
              {view.exhibition.title}
            </Link>{' '}
            as an auction.
          </p>
        )}
        <div className="mt-8">
          <ManageAuction
            auction={view.auction}
            phase={view.phase}
            lots={view.lots}
            pending={view.pendingConsignments}
            available={available}
            hasBids={hasBids}
          />
        </div>
      </div>
    </div>
  );
}
