import { asUntyped } from '~/lib/supabase-untyped';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { EditProvenanceForm } from './_components/edit-provenance-form';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { cosApprovingArtistId } from '~/lib/certificate-claims/cos-approval';
import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';
import { EditorialPageHeader } from '~/components/editorial-form';
import { getArtworkExhibition } from '../../[id]/certificate/_actions/get-artwork-exhibition';
import { ShopListingCard } from './_components/shop-listing-card';
import { getConnectAccount } from '~/lib/stripe-connect';
import { platformFeePercent } from '~/lib/payouts/earnings-math';

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

  // The holder, or a member of the gallery team it's filed under, can edit.
  const { data: artwork, error } = await asUntyped(client)
    .from('artworks')
    .select('*')
    .eq('id', id)
    .single();

  if (
    error ||
    !artwork ||
    !(await canEditGalleryArtworks(user.id, {
      account_id: artwork.account_id,
      gallery_profile_id: artwork.gallery_profile_id ?? undefined,
    }))
  ) {
    redirect('/artworks');
  }
  const isHolder = artwork.account_id === user.id;

  // Get current exhibition for this artwork
  const [currentExhibition, connectAccount] = await Promise.all([
    getArtworkExhibition(id),
    getConnectAccount(user.id),
  ]);

  // A Certificate of Show issued from an artist's CoA: the artist is told about
  // changes and can add them to their CoA.
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

      {isHolder && (
      <ShopListingCard
        artworkId={artwork.id}
        shopOpen={!!connectAccount}
        sold={!!artwork.sold_at || !!artwork.is_sold}
        initialForSale={!!artwork.for_sale}
        initialPrice={artwork.sale_price != null ? Number(artwork.sale_price) : null}
        feePercent={platformFeePercent()}
      />
      )}

      <EditProvenanceForm 
        artwork={artwork} 
        currentExhibitionId={currentExhibition?.id || null}
        approverName={approverName}
      />
    </div>
  );
}

