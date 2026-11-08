import { asUntyped } from '~/lib/supabase-untyped';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { EditProvenanceForm } from './_components/edit-provenance-form';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { cosApprovingArtistId } from '~/lib/certificate-claims/cos-approval';
import { EditorialPageHeader } from '~/components/editorial-form';
import { getArtworkExhibition } from '../../[id]/certificate/_actions/get-artwork-exhibition';

export const metadata = {
  title: 'Edit Provenance | Provenance',
};

export default async function EditProvenancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Fetch artwork - only the owner can edit
  const { data: artwork, error } = await asUntyped(client)
    .from('artworks')
    .select('*')
    .eq('id', id)
    .eq('account_id', user.id)
    .single();

  if (error || !artwork) {
    redirect('/artworks');
  }

  // Get current exhibition for this artwork
  const currentExhibition = await getArtworkExhibition(id);

  // A Certificate of Show issued from an artist's CoA: content changes go to
  // the artist to approve.
  const approvingArtistId = cosApprovingArtistId(artwork);
  let approverName: string | null = null;
  if (approvingArtistId && approvingArtistId !== user.id) {
    const { data: artist } = await asUntyped(getSupabaseServerAdminClient())
      .from('accounts')
      .select('name')
      .eq('id', approvingArtistId)
      .maybeSingle();
    approverName = (artist?.name as string | undefined) || artwork.artist_name || 'the artist';
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <EditorialPageHeader
        eyebrow="Certificate / Edit"
        title="Edit artwork"
        description={<>Update the details and provenance for <span className="text-editorial-ink">“{artwork.title}”</span>.</>}
      />

      <EditProvenanceForm 
        artwork={artwork} 
        currentExhibitionId={currentExhibition?.id || null}
        approverName={approverName}
      />
    </div>
  );
}

