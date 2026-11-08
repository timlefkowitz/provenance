import { asUntyped } from '~/lib/supabase-untyped';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { logger } from '~/lib/logger';
import {
  getAccountDisplayName,
  propagateProvenanceAfterLinkedCertificate,
} from '~/lib/certificate-claims/propagate-provenance';

export type SourceArtworkRow = Record<string, unknown>;

/**
 * Metadata for a new linked certificate: everything from the source except its
 * scan history. Scan counts and scan places belong to the certificate that was
 * scanned (and its holder), so a new CoO/CoS/CoA starts at zero.
 */
export function metadataForLinkedCertificate(sourceMetadata: unknown): Record<string, unknown> {
  if (!sourceMetadata || typeof sourceMetadata !== 'object' || Array.isArray(sourceMetadata)) {
    return {};
  }
  const rest: Record<string, unknown> = { ...(sourceMetadata as Record<string, unknown>) };
  delete rest.scan_stats;
  delete rest.scan_locations;
  return rest;
}

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
    const { data } = await client.from('artworks').select('id').eq('certificate_number', certificateNumber).maybeSingle();
    exists = !!data;
    attempts++;
  }
  if (exists) throw new Error('Failed to generate unique certificate number');
  return certificateNumber!;
}

/**
 * Collector's Certificate of Ownership linked to source certificate (COA or COS).
 */
export async function insertLinkedCertificateOfOwnershipFromCoa(
  adminClient: SupabaseClient,
  source: SourceArtworkRow,
  params: { ownerAccountId: string; createdByUserId: string },
): Promise<{ id: string }> {
  return insertLinkedCertificateOfOwnership(adminClient, source, params);
}

/**
 * Name to show as "Owned by" for a collector: their account name, else the
 * buyer name recorded on the sale, else a neutral label (never "Account 1a2b…").
 */
export async function resolveOwnerDisplayName(
  adminClient: SupabaseClient,
  accountId: string,
  source?: SourceArtworkRow,
): Promise<string> {
  const { data } = await asUntyped(adminClient)
    .from('accounts')
    .select('name')
    .eq('id', accountId)
    .maybeSingle();
  const name = (data?.name as string | null | undefined)?.trim();
  if (name) return name;
  const soldToName = (source?.sold_to_name as string | null | undefined)?.trim();
  if (soldToName) return soldToName;
  return 'Private collector';
}

/**
 * Collector's Certificate of Ownership linked to source certificate (COA or COS).
 */
export async function insertLinkedCertificateOfOwnership(
  adminClient: SupabaseClient,
  source: SourceArtworkRow,
  params: { ownerAccountId: string; createdByUserId: string },
): Promise<{ id: string }> {
  const certNumber = await generateCertificateNumber(adminClient);
  const sourceId = source.id as string;

  const { data, error } = await asUntyped(adminClient)
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
      metadata: metadataForLinkedCertificate(source.metadata),
      certificate_number: certNumber,
      certificate_type: CERTIFICATE_TYPES.OWNERSHIP,
      source_artwork_id: sourceId,
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
  try {
    const actorName = await resolveOwnerDisplayName(adminClient, params.ownerAccountId, source);
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
 * Credits the claiming artist on every show the source certificate is selected
 * in. The new COA isn't in exhibition_artworks (the gallery's CoS is), and a
 * work uploaded before the artist joined was credited to a placeholder
 * account, so without this the show never reaches the artist's profile.
 */
async function creditArtistOnSourceExhibitions(
  adminClient: SupabaseClient,
  source: SourceArtworkRow,
  artistId: string,
): Promise<void> {
  const sourceId = source.id as string;
  const exhibitionIds = new Set<string>();

  const { data: links, error: linksError } = await asUntyped(adminClient)
    .from('exhibition_artworks')
    .select('exhibition_id')
    .eq('artwork_id', sourceId)
    .eq('status', 'selected');
  if (linksError) {
    logger.error('insert_artist_coa_exhibition_links_failed', { sourceId, error: linksError });
  }
  for (const row of links ?? []) {
    if (row.exhibition_id) exhibitionIds.add(row.exhibition_id as string);
  }

  const metadataExhibitionId = (source.metadata as Record<string, unknown> | null)?.exhibition_id;
  if (typeof metadataExhibitionId === 'string' && metadataExhibitionId) {
    exhibitionIds.add(metadataExhibitionId);
  }

  for (const exhibitionId of exhibitionIds) {
    const { error } = await asUntyped(adminClient)
      .from('exhibition_artists')
      .insert({ exhibition_id: exhibitionId, artist_account_id: artistId });
    if (error && error.code !== '23505') {
      logger.error('insert_artist_coa_exhibition_credit_failed', { exhibitionId, error });
    }
  }
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

  const { data: newArtwork, error: insertError } = await asUntyped(adminClient)
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
      metadata: metadataForLinkedCertificate(source.metadata),
      certificate_number: certNumber,
      certificate_type: CERTIFICATE_TYPES.AUTHENTICITY,
      source_artwork_id: sourceId,
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

  const { error: updateSourceError } = await asUntyped(adminClient)
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
  await creditArtistOnSourceExhibitions(adminClient, source, artistId);
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
