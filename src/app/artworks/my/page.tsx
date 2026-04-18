import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Images } from 'lucide-react';
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
      <div className="min-h-[calc(100vh-5rem)] bg-parchment">
        <div className="border-b border-wine/15 bg-gradient-to-b from-wine/[0.06] to-transparent">
          <div className="container mx-auto max-w-7xl w-full min-w-0 px-4 sm:px-6 py-8 sm:py-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-px w-10 bg-wine/35 shrink-0" aria-hidden />
                  <p className="text-[11px] font-landing font-light tracking-[0.28em] text-ink/45 uppercase">
                    Your collection
                  </p>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-wine tracking-tight">
                  Collection
                </h1>
                <p className="text-base sm:text-lg text-ink/70 font-serif leading-relaxed">
                  Register artworks, refine provenance, and keep your holdings organized in one
                  place.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/artworks/add"
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-wine px-6 font-serif text-sm font-medium text-parchment transition-colors hover:bg-wine/90"
                >
                  Add your first artwork
                </Link>
                <Link
                  href="/subscription?role=collector"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-wine/30 bg-parchment/80 px-6 font-serif text-sm font-medium text-wine transition-colors hover:border-wine/50 hover:bg-wine/5"
                >
                  Collector subscription
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto max-w-7xl w-full min-w-0 px-4 sm:px-6 py-10 sm:py-14">
          <div className="mx-auto max-w-lg rounded-2xl border border-wine/15 bg-parchment/80 p-8 sm:p-10 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-wine/10 text-wine">
              <Images className="h-7 w-7" strokeWidth={1.25} aria-hidden />
            </div>
            <h2 className="font-display text-xl font-semibold text-wine sm:text-2xl">
              No verified artworks yet
            </h2>
            <p className="mt-3 font-serif text-sm text-ink/65 leading-relaxed">
              Once an artwork is verified, it appears here so you can edit details and link it to
              exhibitions.
            </p>
          </div>
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

  const count = artworks.length;

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-parchment pb-8">
      <div className="border-b border-wine/15 bg-gradient-to-b from-wine/[0.06] to-transparent">
        <div className="container mx-auto max-w-7xl w-full min-w-0 overflow-x-hidden px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-4 max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="h-px w-10 bg-wine/35 shrink-0" aria-hidden />
                <p className="text-[11px] font-landing font-light tracking-[0.28em] text-ink/45 uppercase">
                  Your collection
                </p>
                <span
                  className="rounded-full border border-wine/20 bg-parchment/90 px-3 py-0.5 font-serif text-xs text-ink/70"
                  aria-label={`${count} artworks in collection`}
                >
                  {count} {count === 1 ? 'artwork' : 'artworks'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-wine tracking-tight">
                Collection
              </h1>
              <p className="text-base sm:text-lg text-ink/70 font-serif leading-relaxed">
                Tap thumbnails to choose what you are editing, then update provenance in the panel
                below. Save when you are done.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end shrink-0">
              <Link
                href="/artworks/add"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-wine px-5 font-serif text-sm font-medium text-parchment transition-colors hover:bg-wine/90 sm:min-w-[9.5rem]"
              >
                Add artwork
              </Link>
              <Link
                href="/subscription?role=collector"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-wine/30 bg-parchment/80 px-5 font-serif text-sm font-medium text-wine transition-colors hover:border-wine/50 hover:bg-wine/5 sm:min-w-[9.5rem]"
              >
                Subscribe
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl w-full min-w-0 overflow-x-hidden px-4 sm:px-6 py-6 sm:py-8 pb-28 sm:pb-24">
        <SpreadsheetEditForm
          artworks={artworks}
          linkableExhibitions={linkableExhibitions}
          initialExhibitionIdByArtworkId={initialExhibitionIdByArtworkId}
        />
      </div>
    </div>
  );
}
