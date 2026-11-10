'use server';

import { scheduleEntityStatsRefresh } from '~/lib/stats/refresh-entity-stats';
import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';

import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { notifyOwnersOfExhibition } from '~/lib/collectors/notify-owners-of-exhibition';
import {
  issueExhibitionCos,
  notifyArtistOfSelection,
} from '~/lib/certificate-claims/issue-exhibition-cos';
import { logger } from '~/lib/logger';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { isShownInExhibition } from '../_helpers/exhibition-submission-status';

export async function addArtworkToExhibition(exhibitionId: string, artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Owner or gallery team member (e.g. the registrar)
  const { data: exhibition } = await asUntyped(client)
    .from('exhibitions')
    .select('id, title, gallery_id, owner_role, gallery_profile_id')
    .eq('id', exhibitionId)
    .single();

  if (!exhibition || !(await canManageExhibition(user.id, exhibition.gallery_id))) {
    throw new Error('Exhibition not found or access denied');
  }

  // Add artwork to exhibition
  const { error } = await asUntyped(client)
    .from('exhibition_artworks')
    .insert({
      exhibition_id: exhibitionId,
      artwork_id: artworkId,
    });

  if (error) {
    // Ignore duplicate key errors
    if (error.code !== '23505') {
      console.error('Error adding artwork to exhibition:', error);
      throw new Error('Failed to add artwork to exhibition');
    }
  }

  // Selecting an artist's CoA into the show issues the show's Certificate of
  // Show, which the curator edits (with the artist's approval) from then on.
  const cosArtworkId = await issueCosForSelectedArtwork(exhibition, artworkId, user.id);

  await notifyOwnersOfExhibition({
    exhibitionId,
    artworkIds: [artworkId, ...(cosArtworkId ? [cosArtworkId] : [])],
    actorUserId: user.id,
  });

  scheduleEntityStatsRefresh({
    artworkIds: [artworkId, ...(cosArtworkId ? [cosArtworkId] : [])],
    accountIds: [exhibition.gallery_id],
  });

  revalidatePath('/exhibitions');
  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/exhibitions/${exhibitionId}/curate`);
  revalidatePath(`/artists/${exhibition.gallery_id}`);

  return { success: true, cosArtworkId };
}

type ExhibitionForSelection = {
  id: string;
  title: string;
  gallery_id: string;
  owner_role: string | null;
};

async function issueCosForSelectedArtwork(
  exhibition: ExhibitionForSelection,
  artworkId: string,
  actorUserId: string,
): Promise<string | null> {
  const adminClient = getSupabaseServerAdminClient();
  const db = asUntyped(adminClient);
  try {
    const [{ data: coa }, { data: link }] = await Promise.all([
      db.from('artworks').select('*').eq('id', artworkId).maybeSingle(),
      db
        .from('exhibition_artworks')
        .select('cos_artwork_id')
        .eq('exhibition_id', exhibition.id)
        .eq('artwork_id', artworkId)
        .maybeSingle(),
    ]);
    if (!coa) return null;

    const { cosArtworkId, issued } = await issueExhibitionCos(adminClient, {
      exhibition,
      coa,
      actorUserId,
      existingCosId: (link?.cos_artwork_id as string | null) ?? null,
    });
    if (issued) {
      await notifyArtistOfSelection(adminClient, { exhibition, coa, actorUserId, cosArtworkId });
    }
    return cosArtworkId;
  } catch (err) {
    // The work is in the show either way; the COS can be issued later from the curator view.
    logger.error('add_artwork_to_exhibition_cos_failed', { exhibitionId: exhibition.id, artworkId, error: err });
    return null;
  }
}

/**
 * Issues Certificates of Show for works already selected into the show
 * without one (selected before curator shows issued them, or added while
 * issuing failed). Returns how many were issued.
 */
export async function issueMissingCertificatesOfShow(
  exhibitionId: string,
): Promise<{ success: true; issued: number; failed: number } | { success: false; error: string }> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const adminClient = getSupabaseServerAdminClient();
  const db = asUntyped(adminClient);
  const { data: exhibition } = await db
    .from('exhibitions')
    .select('id, title, gallery_id, owner_role, gallery_profile_id')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (!exhibition || !(await canManageExhibition(user.id, exhibition.gallery_id))) {
    return { success: false, error: 'Exhibition not found or access denied' };
  }

  const { data: links } = await db
    .from('exhibition_artworks')
    .select('artwork_id, status')
    .eq('exhibition_id', exhibitionId)
    .is('cos_artwork_id', null);
  const ids = (links ?? [])
    .filter((l: { status: unknown }) => isShownInExhibition(l.status))
    .map((l: { artwork_id: string }) => l.artwork_id);
  if (ids.length === 0) return { success: true, issued: 0, failed: 0 };

  const { data: coas } = await db
    .from('artworks')
    .select('*')
    .in('id', ids)
    .eq('certificate_type', CERTIFICATE_TYPES.AUTHENTICITY)
    .in('status', ['verified', 'draft']);

  let issued = 0;
  let failed = 0;
  for (const coa of (coas ?? []) as Record<string, unknown>[]) {
    try {
      const result = await issueExhibitionCos(adminClient, { exhibition, coa, actorUserId: user.id });
      if (result.issued) {
        issued += 1;
        await notifyArtistOfSelection(adminClient, {
          exhibition,
          coa,
          actorUserId: user.id,
          cosArtworkId: result.cosArtworkId,
        });
      }
    } catch (err) {
      failed += 1;
      logger.error('issue_missing_cos_failed', { exhibitionId, artworkId: coa.id, error: err });
    }
  }

  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/exhibitions/${exhibitionId}/curate`);
  revalidatePath(`/artists/${exhibition.gallery_id}`);
  return { success: true, issued, failed };
}

export async function removeArtworkFromExhibition(exhibitionId: string, artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Owner or gallery team member (e.g. the registrar)
  const { data: exhibition } = await asUntyped(client)
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .single();

  if (!exhibition || !(await canManageExhibition(user.id, exhibition.gallery_id))) {
    throw new Error('Exhibition not found or access denied');
  }

  // Remove artwork from exhibition
  const { error } = await asUntyped(client)
    .from('exhibition_artworks')
    .delete()
    .eq('exhibition_id', exhibitionId)
    .eq('artwork_id', artworkId);

  if (error) {
    console.error('Error removing artwork from exhibition:', error);
    throw new Error('Failed to remove artwork from exhibition');
  }

  scheduleEntityStatsRefresh({ artworkIds: [artworkId], accountIds: [exhibition.gallery_id] });

  revalidatePath('/exhibitions');
  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/artists/${exhibition.gallery_id}`);

  return { success: true };
}

