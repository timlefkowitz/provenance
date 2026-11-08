import type { SupabaseClient } from '@supabase/supabase-js';

import { asUntyped } from '~/lib/supabase-untyped';
import { CERTIFICATE_TYPES, USER_ROLES } from '~/lib/user-roles';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';
import { insertLinkedCoSFromArtistCoa } from './insert-linked-cos-from-artist-coa';
import { shouldIssueExhibitionCos } from './cos-approval';

type ExhibitionForCos = {
  id: string;
  title: string;
  gallery_id: string;
  owner_role: string | null;
};

/**
 * The profile a show's Certificate of Show is filed under. Gallery and
 * institution shows tag their team profile (gallery pages, market cap); a
 * curator's own show has no team profile, so its certificates stay untagged.
 */
async function loadIssuingProfileId(
  adminClient: SupabaseClient,
  exhibition: ExhibitionForCos,
): Promise<string | null> {
  const role =
    exhibition.owner_role === USER_ROLES.INSTITUTION
      ? USER_ROLES.INSTITUTION
      : exhibition.owner_role === USER_ROLES.GALLERY || !exhibition.owner_role
        ? USER_ROLES.GALLERY
        : null;
  if (!role) return null;
  const { data } = await asUntyped(adminClient)
    .from('user_profiles')
    .select('id')
    .eq('user_id', exhibition.gallery_id)
    .eq('role', role)
    .eq('is_active', true)
    // Galleries can have several active profiles; maybeSingle() alone errors on that.
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Issues the show's Certificate of Show for an artist's CoA selected into an
 * exhibition, links it into the show and records it on the CoA's
 * exhibition_artworks row. Returns the existing COS when one was already
 * issued, and null when the work doesn't get one (the organiser's own work,
 * not a CoA, or a collector's show).
 */
export async function issueExhibitionCos(
  adminClient: SupabaseClient,
  params: {
    exhibition: ExhibitionForCos;
    coa: Record<string, unknown>;
    actorUserId: string;
    /** Recorded as the certificate's creator; defaults to the actor. */
    createdByUserId?: string;
    existingCosId?: string | null;
  },
): Promise<{ cosArtworkId: string | null; issued: boolean }> {
  const { exhibition, coa, actorUserId } = params;
  if (params.existingCosId) return { cosArtworkId: params.existingCosId, issued: false };

  if (
    !shouldIssueExhibitionCos({
      ownerRole: exhibition.owner_role,
      ownerAccountId: exhibition.gallery_id,
      certificateType: (coa.certificate_type as string | null) ?? null,
      holderAccountId: (coa.account_id as string | null) ?? null,
    })
  ) {
    return { cosArtworkId: null, issued: false };
  }

  const db = asUntyped(adminClient);

  // A COS from an earlier selection (e.g. removed and re-added) is reused.
  // (Two steps: exhibition_artworks references artworks twice, so an embed is ambiguous.)
  const { data: priorCos } = await db
    .from('artworks')
    .select('id')
    .eq('source_artwork_id', coa.id as string)
    .eq('certificate_type', CERTIFICATE_TYPES.SHOW)
    .eq('account_id', exhibition.gallery_id);
  const priorIds = ((priorCos ?? []) as { id: string }[]).map((r) => r.id);
  const { data: prior } = priorIds.length
    ? await db
        .from('exhibition_artworks')
        .select('artwork_id')
        .eq('exhibition_id', exhibition.id)
        .in('artwork_id', priorIds)
        .limit(1)
        .maybeSingle()
    : { data: null };

  let cosArtworkId = (prior?.artwork_id as string | undefined) ?? null;
  const issued = !cosArtworkId;

  if (!cosArtworkId) {
    const galleryProfileId = await loadIssuingProfileId(adminClient, exhibition);
    const { id } = await insertLinkedCoSFromArtistCoa(adminClient, coa, {
      galleryAccountId: exhibition.gallery_id,
      createdByUserId: params.createdByUserId ?? actorUserId,
      galleryProfileId,
    });
    cosArtworkId = id;

    const { error: linkError } = await db.from('exhibition_artworks').insert({
      exhibition_id: exhibition.id,
      artwork_id: cosArtworkId,
    });
    if (linkError && linkError.code !== '23505') {
      logger.error('exhibition_cos_link_failed', { exhibitionId: exhibition.id, cosArtworkId, error: linkError });
    }
  }

  const { error: recordError } = await db
    .from('exhibition_artworks')
    .update({ cos_artwork_id: cosArtworkId })
    .eq('exhibition_id', exhibition.id)
    .eq('artwork_id', coa.id as string);
  if (recordError) {
    logger.error('exhibition_cos_record_failed', { exhibitionId: exhibition.id, cosArtworkId, error: recordError });
  }

  return { cosArtworkId, issued };
}

/** Tells the artist their work was selected for a show, and that a COS was issued for it. */
export async function notifyArtistOfSelection(
  adminClient: SupabaseClient,
  params: {
    exhibition: ExhibitionForCos;
    coa: Record<string, unknown>;
    actorUserId: string;
    cosArtworkId: string | null;
  },
): Promise<void> {
  const { exhibition, coa, actorUserId, cosArtworkId } = params;
  const artistAccountId = (coa.account_id as string | null) ?? null;
  if (!artistAccountId || artistAccountId === actorUserId) return;

  try {
    // The open call page shows the artist their status even while the
    // exhibition itself is still an unpublished draft.
    const { data: openCall } = await asUntyped(adminClient)
      .from('open_calls')
      .select('slug')
      .eq('exhibition_id', exhibition.id)
      .eq('submission_mode', 'exhibition')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const title = (coa.title as string | null) ?? 'Your artwork';
    await createNotification({
      userId: artistAccountId,
      type: 'exhibition_artwork_selected',
      title: `Selected for "${exhibition.title}"`,
      message: cosArtworkId
        ? `"${title}" was selected for the exhibition "${exhibition.title}" and a Certificate of Show was issued for it. Changes the curator makes to that certificate come to you to approve.`
        : `"${title}" was selected for the exhibition "${exhibition.title}".`,
      artworkId: coa.id as string,
      relatedUserId: actorUserId,
      metadata: {
        exhibition_id: exhibition.id,
        cos_artwork_id: cosArtworkId,
        open_call_slug: (openCall?.slug as string | undefined) ?? null,
      },
    });
  } catch (err) {
    logger.error('exhibition_selection_notify_failed', { exhibitionId: exhibition.id, error: err });
  }
}
