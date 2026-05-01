import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserExhibitions } from '~/app/artworks/add/_actions/get-user-exhibitions';
import { getUserRole } from '~/lib/user-roles';
import { readPerspective } from '~/lib/read-perspective';
import { SpreadsheetEditForm } from './_components/spreadsheet-edit-form';

export const metadata = {
  title: 'Collection Management | Provenance',
};

export default async function MassEditProvenancePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const params = await searchParams;
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const { data: accountRow } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();
  const senderRole = getUserRole((accountRow?.public_data ?? {}) as Record<string, unknown>);

  // Fetch gallery/institution profiles for the "Sending as" selector in the Send dialogs
  const perspective = await readPerspective();
  const profileRole = perspective === 'gallery' || perspective === 'institution'
    ? perspective
    : (senderRole === 'gallery' || senderRole === 'institution' ? senderRole : null);

  let galleryProfiles: { id: string; name: string; role: string }[] = [];
  if (profileRole) {
    const { data: profileRows } = await (client as any)
      .from('user_profiles')
      .select('id, name, role')
      .eq('user_id', user.id)
      .in('role', ['gallery', 'institution'])
      .eq('is_active', true);
    galleryProfiles = (profileRows ?? []).map((p: { id: string; name: string; role: string }) => ({
      id: p.id,
      name: p.name,
      role: p.role,
    }));
  }

  const artworkIds = params.ids?.split(',').filter(Boolean) || [];

  if (artworkIds.length === 0) {
    redirect('/artworks/my');
  }

  // Fetch the selected artworks with all provenance fields
  const { data: artworks, error } = await client
    .from('artworks')
    .select(
      `id, title, artist_name, description, creation_date, certificate_number, account_id,
       medium, dimensions, former_owners, auction_history, exhibition_history,
       historic_context, celebrity_notes, is_public, value, value_is_public,
       edition, production_location, owned_by, owned_by_is_public, sold_by, sold_by_is_public,
       image_url, created_at, is_sold, display_order, certificate_type, status`
    )
    .in('id', artworkIds)
    .eq('account_id', user.id)
    .in('status', ['verified', 'draft']);

  if (error || !artworks || artworks.length === 0) {
    redirect('/artworks/my');
  }

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
    <div className="container mx-auto px-4 py-8 max-w-5xl w-full min-w-0 overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Collection Management
        </h1>
        <p className="text-ink/70 font-serif mb-4">
          Select artworks from the horizontal strip, then edit provenance information below.
        </p>
      </div>

      <SpreadsheetEditForm
        artworks={artworks}
        linkableExhibitions={linkableExhibitions}
        initialExhibitionIdByArtworkId={initialExhibitionIdByArtworkId}
        senderRole={senderRole}
        galleryProfiles={galleryProfiles}
      />
    </div>
  );
}
