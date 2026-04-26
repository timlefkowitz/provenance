import type { SupabaseClient } from '@supabase/supabase-js';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { logger } from '~/lib/logger';
import {
  getAccountDisplayName,
  propagateProvenanceAfterLinkedCertificate,
  createCertificateLinks,
} from '~/lib/certificate-claims/propagate-provenance';

export type SourceArtworkRow = Record<string, unknown>;

export async function generateCertificateNumber(client: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await client.rpc('generate_certificate_number');
    if (!error && data) return data as string;
  } catch (err) {
    logger.error('generate_certificate_number_failed', { error: err });
  }
  let certificateNumber: string;
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 10) {
    certificateNumber = `PROV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const { data } = await client
      .from('artworks')
      .select('id')
      .eq('certificate_number', certificateNumber)
      .maybeSingle();
    exists = !!data;
    attempts++;
  }
  if (exists) throw new Error('Failed to generate unique certificate number');
  return certificateNumber!;
}

/**
 * Determine the chain_root_id for a new linked certificate.
 * If the source has a chain_root_id, use that. Otherwise, source is the root.
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

  // If source has a chain_root_id, propagate it
  if (data.chain_root_id) {
    return data.chain_root_id as string;
  }

  // If source has no source_artwork_id, it is the root
  if (!data.source_artwork_id) {
    return data.id as string;
  }

  // Source is linked but chain_root_id not set - traverse to find root
  return sourceArtworkId;
}

/**
 * Collector's Certificate of Ownership linked to an artist's COA (artist keeps COA).
 */
export async function insertLinkedCertificateOfOwnershipFromCoa(
  adminClient: SupabaseClient,
  source: SourceArtworkRow,
  params: { ownerAccountId: string; createdByUserId: string },
): Promise<{ id: string }> {
  const certNumber = await generateCertificateNumber(adminClient);
  const sourceId = source.id as string;

  // Determine the chain root
  const chainRootId = await getChainRootId(adminClient, sourceId);

  const { data, error } = await (adminClient as any)
    .from('artworks')
    .insert({
      account_id: params.ownerAccountId,
      title: source.title,
      description: source.description,
      artist_name: source.artist_name,
      creation_date: source.creation_date,
      medium: source.medium,
      dimensions: source.dimensions,
      image_url: source.image_url,
      former_owners: source.former_owners,
      auction_history: source.auction_history,
      exhibition_history: source.exhibition_history,
      historic_context: source.historic_context,
      celebrity_notes: source.celebrity_notes,
      value: source.value,
      value_is_public: source.value_is_public,
      edition: source.edition,
      production_location: source.production_location,
      owned_by: source.owned_by,
      owned_by_is_public: source.owned_by_is_public,
      sold_by: source.sold_by,
      sold_by_is_public: source.sold_by_is_public,
      metadata: source.metadata || {},
      certificate_number: certNumber,
      certificate_type: CERTIFICATE_TYPES.OWNERSHIP,
      source_artwork_id: sourceId,
      chain_root_id: chainRootId,
      artist_account_id: source.artist_account_id ?? null,
      gallery_profile_id: null,
      status: 'verified',
      certificate_status: 'verified',
      created_by: params.createdByUserId,
      updated_by: params.createdByUserId,
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('insert_linked_coo_failed', { sourceId, error });
    throw new Error(error?.message || 'Failed to create Certificate of Ownership');
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
    logger.error('insert_linked_coo_create_links_failed', { newId, error: linkErr });
  }

  // Propagate provenance
  try {
    const actorName = await getAccountDisplayName(adminClient, params.ownerAccountId);
    await propagateProvenanceAfterLinkedCertificate(adminClient, {
      eventKind: 'coo_issued',
      newArtworkId: newId,
      actorAccountId: params.ownerAccountId,
      actorDisplayName: actorName,
    });
  } catch (propErr) {
    logger.error('insert_linked_coo_propagate_failed', { newId, error: propErr });
  }

  return { id: newId };
}

/**
 * Artist's Certificate of Authenticity linked to show or ownership source (after owner approved claim).
 */
export async function insertArtistCoaFromSourceCertificate(
  adminClient: SupabaseClient,
  source: SourceArtworkRow,
  params: { artistAccountId: string; createdByUserId: string },
): Promise<{ id: string }> {
  const certNumber = await generateCertificateNumber(adminClient);
  const sourceId = source.id as string;
  const now = new Date().toISOString();
  const artistId = params.artistAccountId;

  // Determine the chain root
  const chainRootId = await getChainRootId(adminClient, sourceId);

  const { data: newArtwork, error: insertError } = await (adminClient as any)
    .from('artworks')
    .insert({
      account_id: artistId,
      title: source.title,
      description: source.description,
      artist_name: source.artist_name,
      creation_date: source.creation_date,
      medium: source.medium,
      dimensions: source.dimensions,
      image_url: source.image_url,
      former_owners: source.former_owners,
      auction_history: source.auction_history,
      exhibition_history: source.exhibition_history,
      historic_context: source.historic_context,
      celebrity_notes: source.celebrity_notes,
      value: source.value,
      value_is_public: source.value_is_public,
      edition: source.edition,
      production_location: source.production_location,
      owned_by: source.owned_by,
      owned_by_is_public: source.owned_by_is_public,
      sold_by: source.sold_by,
      sold_by_is_public: source.sold_by_is_public,
      metadata: source.metadata || {},
      certificate_number: certNumber,
      certificate_type: CERTIFICATE_TYPES.AUTHENTICITY,
      source_artwork_id: sourceId,
      chain_root_id: chainRootId,
      artist_account_id: artistId,
      status: 'verified',
      certificate_status: 'verified',
      created_by: params.createdByUserId,
      updated_by: params.createdByUserId,
    })
    .select('id')
    .single();

  if (insertError || !newArtwork) {
    logger.error('insert_artist_coa_from_source_failed', { sourceId, error: insertError });
    throw new Error(insertError?.message || 'Failed to create Certificate of Authenticity');
  }

  const { error: updateSourceError } = await (adminClient as any)
    .from('artworks')
    .update({
      artist_account_id: artistId,
      certificate_status: 'verified',
      claimed_by_artist_at: now,
      verified_by_owner_at: now,
      updated_by: params.createdByUserId,
    })
    .eq('id', sourceId);

  if (updateSourceError) {
    logger.error('insert_artist_coa_update_source_failed', { sourceId, error: updateSourceError });
  }

  const outId = newArtwork.id as string;

  // Create bidirectional certificate links
  try {
    await createCertificateLinks(adminClient, {
      newArtworkId: outId,
      sourceArtworkId: sourceId,
      rootId: chainRootId,
    });
  } catch (linkErr) {
    logger.error('insert_artist_coa_create_links_failed', { outId, error: linkErr });
  }

  // Propagate provenance
  try {
    const actorName = await getAccountDisplayName(adminClient, artistId);
    await propagateProvenanceAfterLinkedCertificate(adminClient, {
      eventKind: 'coa_issued',
      newArtworkId: outId,
      actorAccountId: artistId,
      actorDisplayName: actorName,
    });
  } catch (propErr) {
    logger.error('insert_artist_coa_propagate_failed', { outId, error: propErr });
  }

  return { id: outId };
}

// ============================================================================
// NEW: COO-first flows (Collector creates root certificate first)
// ============================================================================

/**
 * Artist's Certificate of Authenticity linked to a collector's COO that is the root.
 * Used when collector created the COO first, then invites artist.
 */
export async function insertArtistCoaFromCooRoot(
  adminClient: SupabaseClient,
  sourceCoo: SourceArtworkRow,
  params: { artistAccountId: string; createdByUserId: string },
): Promise<{ id: string }> {
  const certNumber = await generateCertificateNumber(adminClient);
  const sourceId = sourceCoo.id as string;
  const now = new Date().toISOString();
  const artistId = params.artistAccountId;

  // The COO is the root, so chain_root_id points to it
  const chainRootId = sourceId;

  const { data: newArtwork, error: insertError } = await (adminClient as any)
    .from('artworks')
    .insert({
      account_id: artistId,
      title: sourceCoo.title,
      description: sourceCoo.description,
      artist_name: sourceCoo.artist_name,
      creation_date: sourceCoo.creation_date,
      medium: sourceCoo.medium,
      dimensions: sourceCoo.dimensions,
      image_url: sourceCoo.image_url,
      former_owners: sourceCoo.former_owners,
      auction_history: sourceCoo.auction_history,
      exhibition_history: sourceCoo.exhibition_history,
      historic_context: sourceCoo.historic_context,
      celebrity_notes: sourceCoo.celebrity_notes,
      value: sourceCoo.value,
      value_is_public: sourceCoo.value_is_public,
      edition: sourceCoo.edition,
      production_location: sourceCoo.production_location,
      owned_by: sourceCoo.owned_by,
      owned_by_is_public: sourceCoo.owned_by_is_public,
      sold_by: sourceCoo.sold_by,
      sold_by_is_public: sourceCoo.sold_by_is_public,
      metadata: sourceCoo.metadata || {},
      certificate_number: certNumber,
      certificate_type: CERTIFICATE_TYPES.AUTHENTICITY,
      source_artwork_id: sourceId,
      chain_root_id: chainRootId,
      artist_account_id: artistId,
      status: 'verified',
      certificate_status: 'verified',
      created_by: params.createdByUserId,
      updated_by: params.createdByUserId,
    })
    .select('id')
    .single();

  if (insertError || !newArtwork) {
    logger.error('insert_artist_coa_from_coo_root_failed', { sourceId, error: insertError });
    throw new Error(insertError?.message || 'Failed to create Certificate of Authenticity');
  }

  // Update the source COO with artist account
  const { error: updateSourceError } = await (adminClient as any)
    .from('artworks')
    .update({
      artist_account_id: artistId,
      claimed_by_artist_at: now,
      updated_by: params.createdByUserId,
    })
    .eq('id', sourceId);

  if (updateSourceError) {
    logger.error('insert_artist_coa_from_coo_root_update_source_failed', {
      sourceId,
      error: updateSourceError,
    });
  }

  const outId = newArtwork.id as string;

  // Create bidirectional certificate links
  try {
    await createCertificateLinks(adminClient, {
      newArtworkId: outId,
      sourceArtworkId: sourceId,
      rootId: chainRootId,
    });
  } catch (linkErr) {
    logger.error('insert_artist_coa_from_coo_root_create_links_failed', { outId, error: linkErr });
  }

  // Propagate provenance
  try {
    const actorName = await getAccountDisplayName(adminClient, artistId);
    await propagateProvenanceAfterLinkedCertificate(adminClient, {
      eventKind: 'coa_issued',
      newArtworkId: outId,
      actorAccountId: artistId,
      actorDisplayName: actorName,
    });
  } catch (propErr) {
    logger.error('insert_artist_coa_from_coo_root_propagate_failed', { outId, error: propErr });
  }

  return { id: outId };
}

/**
 * Gallery Certificate of Show linked to a collector's COO that is the root.
 * Used when collector owns artwork and invites gallery for exhibition.
 */
export async function insertLinkedCosFromCoo(
  adminClient: SupabaseClient,
  sourceCoo: SourceArtworkRow,
  params: {
    galleryAccountId: string;
    createdByUserId: string;
    galleryProfileId?: string | null;
  },
): Promise<{ id: string }> {
  const certNumber = await generateCertificateNumber(adminClient);
  const sourceId = sourceCoo.id as string;

  // Determine the chain root (could be the COO itself or its root)
  const chainRootId = await getChainRootId(adminClient, sourceId);

  const { data, error } = await (adminClient as any)
    .from('artworks')
    .insert({
      account_id: params.galleryAccountId,
      title: sourceCoo.title,
      description: sourceCoo.description,
      artist_name: sourceCoo.artist_name,
      creation_date: sourceCoo.creation_date,
      medium: sourceCoo.medium,
      dimensions: sourceCoo.dimensions,
      image_url: sourceCoo.image_url,
      former_owners: sourceCoo.former_owners,
      auction_history: sourceCoo.auction_history,
      exhibition_history: sourceCoo.exhibition_history,
      historic_context: sourceCoo.historic_context,
      celebrity_notes: sourceCoo.celebrity_notes,
      value: sourceCoo.value,
      value_is_public: sourceCoo.value_is_public,
      edition: sourceCoo.edition,
      production_location: sourceCoo.production_location,
      owned_by: sourceCoo.owned_by,
      owned_by_is_public: sourceCoo.owned_by_is_public,
      sold_by: sourceCoo.sold_by,
      sold_by_is_public: sourceCoo.sold_by_is_public,
      metadata: sourceCoo.metadata || {},
      certificate_number: certNumber,
      certificate_type: CERTIFICATE_TYPES.SHOW,
      source_artwork_id: sourceId,
      chain_root_id: chainRootId,
      artist_account_id: sourceCoo.artist_account_id ?? null,
      gallery_profile_id: params.galleryProfileId ?? null,
      status: 'verified',
      certificate_status: 'verified',
      created_by: params.createdByUserId,
      updated_by: params.createdByUserId,
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('insert_linked_cos_from_coo_failed', { sourceId, error });
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
    logger.error('insert_linked_cos_from_coo_create_links_failed', { newId, error: linkErr });
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
    logger.error('insert_linked_cos_from_coo_propagate_failed', { newId, error: propErr });
  }

  return { id: newId };
}

// ============================================================================
// NEW: COS-first flows (Gallery creates root certificate first)
// ============================================================================

/**
 * Artist's Certificate of Authenticity linked to a gallery's COS that is the root.
 * Used when gallery created the COS first (e.g., for an exhibition), then invites artist.
 */
export async function insertArtistCoaFromCosRoot(
  adminClient: SupabaseClient,
  sourceCos: SourceArtworkRow,
  params: { artistAccountId: string; createdByUserId: string },
): Promise<{ id: string }> {
  const certNumber = await generateCertificateNumber(adminClient);
  const sourceId = sourceCos.id as string;
  const now = new Date().toISOString();
  const artistId = params.artistAccountId;

  // The COS is the root, so chain_root_id points to it
  const chainRootId = sourceId;

  const { data: newArtwork, error: insertError } = await (adminClient as any)
    .from('artworks')
    .insert({
      account_id: artistId,
      title: sourceCos.title,
      description: sourceCos.description,
      artist_name: sourceCos.artist_name,
      creation_date: sourceCos.creation_date,
      medium: sourceCos.medium,
      dimensions: sourceCos.dimensions,
      image_url: sourceCos.image_url,
      former_owners: sourceCos.former_owners,
      auction_history: sourceCos.auction_history,
      exhibition_history: sourceCos.exhibition_history,
      historic_context: sourceCos.historic_context,
      celebrity_notes: sourceCos.celebrity_notes,
      value: sourceCos.value,
      value_is_public: sourceCos.value_is_public,
      edition: sourceCos.edition,
      production_location: sourceCos.production_location,
      owned_by: sourceCos.owned_by,
      owned_by_is_public: sourceCos.owned_by_is_public,
      sold_by: sourceCos.sold_by,
      sold_by_is_public: sourceCos.sold_by_is_public,
      metadata: sourceCos.metadata || {},
      certificate_number: certNumber,
      certificate_type: CERTIFICATE_TYPES.AUTHENTICITY,
      source_artwork_id: sourceId,
      chain_root_id: chainRootId,
      artist_account_id: artistId,
      gallery_profile_id: sourceCos.gallery_profile_id ?? null,
      status: 'verified',
      certificate_status: 'verified',
      created_by: params.createdByUserId,
      updated_by: params.createdByUserId,
    })
    .select('id')
    .single();

  if (insertError || !newArtwork) {
    logger.error('insert_artist_coa_from_cos_root_failed', { sourceId, error: insertError });
    throw new Error(insertError?.message || 'Failed to create Certificate of Authenticity');
  }

  // Update the source COS with artist account
  const { error: updateSourceError } = await (adminClient as any)
    .from('artworks')
    .update({
      artist_account_id: artistId,
      claimed_by_artist_at: now,
      updated_by: params.createdByUserId,
    })
    .eq('id', sourceId);

  if (updateSourceError) {
    logger.error('insert_artist_coa_from_cos_root_update_source_failed', {
      sourceId,
      error: updateSourceError,
    });
  }

  const outId = newArtwork.id as string;

  // Create bidirectional certificate links
  try {
    await createCertificateLinks(adminClient, {
      newArtworkId: outId,
      sourceArtworkId: sourceId,
      rootId: chainRootId,
    });
  } catch (linkErr) {
    logger.error('insert_artist_coa_from_cos_root_create_links_failed', { outId, error: linkErr });
  }

  // Propagate provenance
  try {
    const actorName = await getAccountDisplayName(adminClient, artistId);
    await propagateProvenanceAfterLinkedCertificate(adminClient, {
      eventKind: 'coa_issued',
      newArtworkId: outId,
      actorAccountId: artistId,
      actorDisplayName: actorName,
    });
  } catch (propErr) {
    logger.error('insert_artist_coa_from_cos_root_propagate_failed', { outId, error: propErr });
  }

  return { id: outId };
}

/**
 * Collector's Certificate of Ownership linked to a gallery's COS that is the root.
 * Used when gallery has artwork in exhibition and collector purchases it.
 */
export async function insertLinkedCooFromCos(
  adminClient: SupabaseClient,
  sourceCos: SourceArtworkRow,
  params: { ownerAccountId: string; createdByUserId: string },
): Promise<{ id: string }> {
  const certNumber = await generateCertificateNumber(adminClient);
  const sourceId = sourceCos.id as string;

  // Determine the chain root (could be the COS itself or its root)
  const chainRootId = await getChainRootId(adminClient, sourceId);

  const { data, error } = await (adminClient as any)
    .from('artworks')
    .insert({
      account_id: params.ownerAccountId,
      title: sourceCos.title,
      description: sourceCos.description,
      artist_name: sourceCos.artist_name,
      creation_date: sourceCos.creation_date,
      medium: sourceCos.medium,
      dimensions: sourceCos.dimensions,
      image_url: sourceCos.image_url,
      former_owners: sourceCos.former_owners,
      auction_history: sourceCos.auction_history,
      exhibition_history: sourceCos.exhibition_history,
      historic_context: sourceCos.historic_context,
      celebrity_notes: sourceCos.celebrity_notes,
      value: sourceCos.value,
      value_is_public: sourceCos.value_is_public,
      edition: sourceCos.edition,
      production_location: sourceCos.production_location,
      owned_by: sourceCos.owned_by,
      owned_by_is_public: sourceCos.owned_by_is_public,
      sold_by: sourceCos.sold_by,
      sold_by_is_public: sourceCos.sold_by_is_public,
      metadata: sourceCos.metadata || {},
      certificate_number: certNumber,
      certificate_type: CERTIFICATE_TYPES.OWNERSHIP,
      source_artwork_id: sourceId,
      chain_root_id: chainRootId,
      artist_account_id: sourceCos.artist_account_id ?? null,
      gallery_profile_id: sourceCos.gallery_profile_id ?? null,
      status: 'verified',
      certificate_status: 'verified',
      created_by: params.createdByUserId,
      updated_by: params.createdByUserId,
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('insert_linked_coo_from_cos_failed', { sourceId, error });
    throw new Error(error?.message || 'Failed to create Certificate of Ownership');
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
    logger.error('insert_linked_coo_from_cos_create_links_failed', { newId, error: linkErr });
  }

  // Propagate provenance
  try {
    const actorName = await getAccountDisplayName(adminClient, params.ownerAccountId);
    await propagateProvenanceAfterLinkedCertificate(adminClient, {
      eventKind: 'coo_issued',
      newArtworkId: newId,
      actorAccountId: params.ownerAccountId,
      actorDisplayName: actorName,
    });
  } catch (propErr) {
    logger.error('insert_linked_coo_from_cos_propagate_failed', { newId, error: propErr });
  }

  return { id: newId };
}
