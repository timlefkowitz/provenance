import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { EditProvenanceForm } from './_components/edit-provenance-form';
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
  const { data: artwork, error } = await (client as any)
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Edit Provenance Information
        </h1>
        <p className="text-ink/70 font-serif">
          Update the provenance details for "{artwork.title}"
        </p>
      </div>

      <EditProvenanceForm 
        artwork={artwork} 
        currentExhibitionId={currentExhibition?.id || null}
      />
    </div>
  );
}

