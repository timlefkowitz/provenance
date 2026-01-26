import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { SpreadsheetEditForm } from './_components/spreadsheet-edit-form';

export const metadata = {
  title: 'Mass Edit Provenance | Provenance',
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
       image_url`
    )
    .in('id', artworkIds)
    .eq('account_id', user.id) // Ensure user can only see their own artworks
    .eq('status', 'verified');

  if (error || !artworks || artworks.length === 0) {
    redirect('/artworks/my');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Mass Edit Provenance
        </h1>
        <p className="text-ink/70 font-serif mb-4">
          Edit provenance information in the spreadsheet below. Each row represents one artwork. Scroll horizontally to see all fields.
        </p>
      </div>

      <SpreadsheetEditForm artworks={artworks} />
    </div>
  );
}
