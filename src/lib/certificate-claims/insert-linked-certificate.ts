import type { SupabaseClient } from '@supabase/supabase-js';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { logger } from '~/lib/logger';

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
    const { data } = await client.from('artworks').select('id').eq('certificate_number', certificateNumber).maybeSingle();
    exists = !!data;
    attempts++;
  }
  if (exists) throw new Error('Failed to generate unique certificate number');
  return certificateNumber!;
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
  return { id: data.id as string };
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

  return { id: newArtwork.id as string };
}
