import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';
import { createNotification } from '~/lib/notifications';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';

import { loadDescendants } from './certificate-chain';

/**
 * Tell collectors when a work they own is shown in a published exhibition.
 * Owners are the holders of Certificates of Ownership issued from the shown
 * certificate (or the shown certificate itself). The organiser and the person
 * acting are skipped, and each collector hears about a show once.
 * Best-effort: never throws.
 */
export async function notifyOwnersOfExhibition(params: {
  exhibitionId: string;
  /** Limit to these artworks; omit to cover every work shown in the exhibition. */
  artworkIds?: string[];
  actorUserId?: string | null;
}): Promise<void> {
  const admin = asUntyped(getSupabaseServerAdminClient());

  try {
    const { data: exhibition } = await admin
      .from('exhibitions')
      .select('id, title, gallery_id, published_at')
      .eq('id', params.exhibitionId)
      .maybeSingle();
    // Drafts are covered when the exhibition is published.
    if (!exhibition?.published_at) return;

    let artworkIds = params.artworkIds;
    if (!artworkIds) {
      const { data: links } = await admin
        .from('exhibition_artworks')
        .select('artwork_id, status')
        .eq('exhibition_id', params.exhibitionId);
      artworkIds = ((links ?? []) as Array<{ artwork_id: string; status: string | null }>)
        .filter((l) => isShownInExhibition(l.status))
        .map((l) => l.artwork_id);
    }
    if (!artworkIds.length) return;

    const chain = await loadDescendants(admin, artworkIds);
    const skip = new Set([exhibition.gallery_id, params.actorUserId].filter(Boolean));
    const worksByOwner = new Map<string, { artworkId: string; title: string | null }[]>();
    for (const row of chain) {
      if (row.certificate_type !== CERTIFICATE_TYPES.OWNERSHIP || !row.account_id) continue;
      if (skip.has(row.account_id)) continue;
      if (!worksByOwner.has(row.account_id)) worksByOwner.set(row.account_id, []);
      worksByOwner.get(row.account_id)!.push({ artworkId: row.id, title: row.title });
    }
    if (!worksByOwner.size) return;

    const { data: existing } = await admin
      .from('notifications')
      .select('user_id')
      .eq('type', 'owned_artwork_exhibited')
      .in('user_id', Array.from(worksByOwner.keys()))
      .contains('metadata', { exhibition_id: params.exhibitionId });
    const alreadyNotified = new Set(((existing ?? []) as Array<{ user_id: string }>).map((n) => n.user_id));

    for (const [ownerId, works] of worksByOwner) {
      if (alreadyNotified.has(ownerId)) continue;
      const first = works[0]!;
      const label =
        works.length === 1 ? `"${first.title ?? 'Your artwork'}" is` : `${works.length} works from your collection are`;
      try {
        await createNotification({
          userId: ownerId,
          type: 'owned_artwork_exhibited',
          title: `On view in "${exhibition.title}"`,
          message: `${label} in the exhibition "${exhibition.title}". It's been added to the work's exhibition history.`,
          artworkId: first.artworkId,
          relatedUserId: exhibition.gallery_id,
          metadata: {
            exhibition_id: params.exhibitionId,
            artwork_ids: works.map((w) => w.artworkId),
          },
        });
      } catch (err) {
        console.error('[Collectors] notifyOwnersOfExhibition notify failed', err, { ownerId });
      }
    }

    console.log('[Collectors] notifyOwnersOfExhibition complete', {
      exhibitionId: params.exhibitionId,
      owners: worksByOwner.size - alreadyNotified.size,
    });
  } catch (err) {
    console.error('[Collectors] notifyOwnersOfExhibition failed', err);
  }
}
