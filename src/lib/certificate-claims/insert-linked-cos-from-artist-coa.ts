import type { SupabaseClient } from '@supabase/supabase-js';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { logger } from '~/lib/logger';
import { generateCertificateNumber } from './insert-linked-certificate';
import {
  getAccountDisplayName,
  propagateProvenanceAfterLinkedCertificate,
  createCertificateLinks,
} from '~/lib/certificate-claims/propagate-provenance';

/**
 * Creates a Gallery/Institution Certificate of Show linked to an artist's CoA.
 * source_artwork_id → artist CoA establishes the provenance chain.
 */
/**
 * Determine the chain_root_id for a new linked certificate.
 */
async function getChainRootId(
  adminClient: SupabaseClient,
  sourceArtworkId: string,
): Promise<string> {
  const { data } = await (adminClient as any)
    .from('artworks')
    .select('id, chain_root_id, source_artwork_id')
    .eq('id', sourceArtworkId)
    .maybeSingle();

  if (!data) {
    return sourceArtworkId;
  }

  if (data.chain_root_id) {
    return data.chain_root_id as string;
  }

  if (!data.source_artwork_id) {
    return data.id as string;
  }

  return sourceArtworkId;
}

export async function insertLinkedCoSFromArtistCoa(
  adminClient: SupabaseClient,
  sourceCoA: Record<string, unknown>,
  params: {
    galleryAccountId: string;
    createdByUserId: string;
    galleryProfileId?: string | null;
  },
): Promise<{ id: string }> {
  const certNumber = await generateCertificateNumber(adminClient);
  const sourceId = sourceCoA.id as string;

  // Determine the chain root
  const chainRootId = await getChainRootId(adminClient, sourceId);

  const { data, error } = await (adminClient as any)
    .from('artworks')
    .insert({
      account_id: params.galleryAccountId,
      title: sourceCoA.title,
      description: sourceCoA.description,
      artist_name: sourceCoA.artist_name,
      creation_date: sourceCoA.creation_date,
      medium: sourceCoA.medium,
      dimensions: sourceCoA.dimensions,
      image_url: sourceCoA.image_url,
      former_owners: sourceCoA.former_owners,
      auction_history: sourceCoA.auction_history,
      exhibition_history: sourceCoA.exhibition_history,
      historic_context: sourceCoA.historic_context,
      celebrity_notes: sourceCoA.celebrity_notes,
      value: sourceCoA.value,
      value_is_public: sourceCoA.value_is_public,
      edition: sourceCoA.edition,
      production_location: sourceCoA.production_location,
      owned_by: sourceCoA.owned_by,
      owned_by_is_public: sourceCoA.owned_by_is_public,
      sold_by: sourceCoA.sold_by,
      sold_by_is_public: sourceCoA.sold_by_is_public,
      metadata: sourceCoA.metadata || {},
      certificate_number: certNumber,
      certificate_type: CERTIFICATE_TYPES.SHOW,
      source_artwork_id: sourceId,
      chain_root_id: chainRootId,
      artist_account_id: sourceCoA.account_id ?? null,
      gallery_profile_id: params.galleryProfileId ?? null,
      status: 'verified',
      certificate_status: 'verified',
      created_by: params.createdByUserId,
      updated_by: params.createdByUserId,
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('insert_linked_cos_from_artist_coa_failed', { sourceId, error });
    throw new Error(error?.message || 'Failed to create Certificate of Show');
  }

  const newId = data.id as string;

  // Create bidirectional certificate links
  try {
    await createCertificateLinks(adminClient, {
      newArtworkId: newId,
      sourceArtworkId: sourceId,
      rootId: chainRootId,
    });
  } catch (linkErr) {
    logger.error('insert_linked_cos_create_links_failed', { newId, error: linkErr });
  }

  // Propagate provenance
  try {
    const actorName = await getAccountDisplayName(adminClient, params.galleryAccountId);
    await propagateProvenanceAfterLinkedCertificate(adminClient, {
      eventKind: 'cos_issued',
      newArtworkId: newId,
      actorAccountId: params.galleryAccountId,
      actorDisplayName: actorName,
    });
  } catch (propErr) {
    logger.error('insert_linked_cos_propagate_failed', { newId, error: propErr });
  }

  return { id: newId };
}
