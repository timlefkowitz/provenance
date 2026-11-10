import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { canEditGalleryArtworks, canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { getChainArtworkIds } from '~/lib/provenance/chain';
import { asUntyped } from '~/lib/supabase-untyped';

/**
 * Who may record a sale of a work and issue its Certificate of Ownership:
 * the account holding the certificate, a member of that account's gallery /
 * institution team (even when the work has no gallery_profile_id), or a
 * manager of an exhibition that hung any certificate of the work.
 */
export async function canSellArtwork(
  userId: string,
  artwork: { id: string; account_id: string | null; gallery_profile_id?: string | null },
): Promise<boolean> {
  if (!userId) return false;
  if (artwork.account_id === userId) return true;

  if (
    await canEditGalleryArtworks(userId, {
      account_id: artwork.account_id ?? '',
      gallery_profile_id: artwork.gallery_profile_id ?? undefined,
    })
  ) {
    return true;
  }
  if (artwork.account_id && (await canManageExhibition(userId, artwork.account_id))) return true;

  try {
    const admin = getSupabaseServerAdminClient() as unknown as SupabaseClient;
    const { ids } = await getChainArtworkIds(admin, artwork.id);
    const db = asUntyped(admin);
    const { data: links } = await db.from('exhibition_artworks').select('exhibition_id').in('artwork_id', ids);
    const exhibitionIds = [...new Set(((links ?? []) as Array<{ exhibition_id: string }>).map((l) => l.exhibition_id))];
    if (!exhibitionIds.length) return false;
    const { data: shows } = await db.from('exhibitions').select('gallery_id').in('id', exhibitionIds);
    const organisers = [
      ...new Set(((shows ?? []) as Array<{ gallery_id: string | null }>).map((s) => s.gallery_id).filter(Boolean)),
    ] as string[];
    for (const gid of organisers) {
      if (await canManageExhibition(userId, gid)) return true;
    }
  } catch (err) {
    console.error('[Sales] canSellArtwork exhibition check failed', { artworkId: artwork.id, err });
  }
  return false;
}
