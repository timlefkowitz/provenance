import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserExhibitions } from '~/app/artworks/add/_actions/get-user-exhibitions';
import { SpreadsheetEditForm } from '../edit-provenance/_components/spreadsheet-edit-form';

export const metadata = {
  title: 'Collection Management | Provenance',
};

export default async function MyArtworksPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Fetch artworks user owns (explicit filter so we never show other users' artworks)
  const { data: artworks } = await client
    .from('artworks')
    .select(
      `id, title, artist_name, description, creation_date, certificate_number, account_id,
       medium, dimensions, former_owners, auction_history, exhibition_history,
       historic_context, celebrity_notes, is_public, value, value_is_public,
       edition, production_location, owned_by, owned_by_is_public, sold_by, sold_by_is_public,
       image_url, created_at`,
    )
    .eq('account_id', user.id)
    .eq('status', 'verified')
    .order('created_at', { ascending: false });

  if (!artworks || artworks.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl w-full min-w-0 overflow-x-hidden">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-wine mb-2">
              Collection Management
            </h1>
            <p className="text-ink/70 font-serif">
              Add artworks to start managing your collection.
            </p>
          </div>
          <Link
            href="/subscription?role=collector"
            className="self-start sm:self-center inline-flex items-center px-5 py-2.5 rounded-lg bg-wine text-parchment font-serif text-sm font-medium hover:bg-wine/90 transition-colors"
          >
            Subscribe
          </Link>
        </div>
      </div>
    );
  }

  const artworkIds = artworks.map((artwork) => artwork.id);
  const { data: exhibitionLinks } = await client
    .from('exhibition_artworks')
    .select('artwork_id, exhibition_id')
    .in('artwork_id', artworkIds);

  const initialExhibitionIdByArtworkId: Record<string, string | null> = {};
  for (const id of artworkIds) {
    initialExhibitionIdByArtworkId[id] = null;
  }
  for (const row of exhibitionLinks || []) {
    const r = row as { artwork_id: string; exhibition_id: string };
    if (r.artwork_id && r.exhibition_id) {
      initialExhibitionIdByArtworkId[r.artwork_id] = r.exhibition_id;
    }
  }

  let linkableExhibitions = await getUserExhibitions(user.id, {
    forCollectionManagement: true,
  });
  const linkableIds = new Set(linkableExhibitions.map((e) => e.id));
  const linkedIds = new Set(
    Object.values(initialExhibitionIdByArtworkId).filter(Boolean) as string[],
  );
  const missingExhibitionIds = [...linkedIds].filter((id) => !linkableIds.has(id));

  if (missingExhibitionIds.length > 0) {
    const { data: extraRows } = await (client as any)
      .from('exhibitions')
      .select('id, title, start_date, end_date')
      .in('id', missingExhibitionIds);

    for (const row of extraRows || []) {
      if (row?.id && !linkableIds.has(row.id)) {
        linkableExhibitions = [...linkableExhibitions, row];
        linkableIds.add(row.id);
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl w-full min-w-0 overflow-x-hidden">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-wine mb-2">
            Collection Management
          </h1>
          <p className="text-ink/70 font-serif">
            Select an artwork from the image row, then edit provenance details below.
          </p>
        </div>
        <Link
          href="/subscription?role=collector"
          className="self-start sm:self-center inline-flex items-center px-5 py-2.5 rounded-lg bg-wine text-parchment font-serif text-sm font-medium hover:bg-wine/90 transition-colors"
        >
          Subscribe
        </Link>
      </div>

      <SpreadsheetEditForm
        artworks={artworks}
        linkableExhibitions={linkableExhibitions}
        initialExhibitionIdByArtworkId={initialExhibitionIdByArtworkId}
      />
    </div>
  );
}
