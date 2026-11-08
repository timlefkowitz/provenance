'use server';

import { revalidatePath } from 'next/cache';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';
import { containsObjectionableText } from '~/lib/moderation/text-filter';
import { sanitizePublications, type ArtworkPublication } from '~/lib/valuation/provenance-value';

export async function updateArtworkPublications(
  artworkId: string,
  publications: ArtworkPublication[],
): Promise<{ success: boolean; error?: string; publications?: ArtworkPublication[] }> {
  try {
    const client = asUntyped(getSupabaseServerClient());
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { success: false, error: 'You must be signed in' };

    const admin = asUntyped(getSupabaseServerAdminClient());
    const { data: artwork } = await admin
      .from('artworks')
      .select('id, account_id, gallery_profile_id')
      .eq('id', artworkId)
      .maybeSingle();
    if (!artwork) return { success: false, error: 'Artwork not found' };

    const canEdit = await canEditGalleryArtworks(user.id, {
      account_id: artwork.account_id,
      gallery_profile_id: artwork.gallery_profile_id ?? undefined,
    });
    if (!canEdit) return { success: false, error: 'You do not have permission to edit this artwork' };

    const clean = sanitizePublications(publications);
    if (containsObjectionableText(...clean.flatMap((p) => [p.title, p.publication_name ?? null]))) {
      return { success: false, error: 'Please remove objectionable language and try again.' };
    }

    const { error } = await admin.from('artworks').update({ publications: clean }).eq('id', artworkId);
    if (error) {
      console.error('[Publications] update failed', error);
      return { success: false, error: error.message || 'Failed to save publications' };
    }

    revalidatePath(`/artworks/${artworkId}/certificate`);
    return { success: true, publications: clean };
  } catch (err) {
    console.error('[Publications] update threw', err);
    return { success: false, error: (err as Error).message || 'Failed to save publications' };
  }
}
