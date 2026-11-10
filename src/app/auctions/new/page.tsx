import { redirect } from 'next/navigation';

import { NewAuctionForm } from '../_components/new-auction-form';
import { adminDb, getViewer, loadAuctionableArtworks, organizerOptions } from '../_lib/auction-access';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New auction | Provenance' };

export default async function NewAuctionPage({ searchParams }: { searchParams: Promise<{ artworks?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/auth/sign-in?next=/auctions/new');

  const { artworks: artworksParam } = await searchParams;
  const preselected = (artworksParam ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 300);

  const { data: account } = await adminDb().from('accounts').select('name').eq('id', viewer.id).maybeSingle();
  const [artworks, organizers] = await Promise.all([
    loadAuctionableArtworks(viewer.id),
    organizerOptions(viewer.id, `${(account?.name as string) || 'Me'} (personal)`),
  ]);

  return (
    <div className="min-h-screen bg-parchment">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl text-wine">New auction</h1>
        <p className="mt-2 max-w-xl font-serif text-sm text-ink/65">
          Auction works from your collection. Bidding is online and timed: lots close one after another, and a late
          bid extends the lot. When a lot sells, the winner is notified, the sale is recorded and a Certificate of
          Ownership is sent; you arrange payment with them directly.
        </p>
        <div className="mt-8">
          <NewAuctionForm artworks={artworks} preselected={preselected} organizers={organizers} />
        </div>
      </div>
    </div>
  );
}
