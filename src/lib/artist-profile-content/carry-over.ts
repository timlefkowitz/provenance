import 'server-only';

import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { logger } from '~/lib/logger';
import { buildCarryOverUpdate, type CarryOverProfile } from './fields';

const CONTENT_COLUMNS =
  'id, bio, artist_statement, header_image_url, artist_cv_json, artist_cv_file_url, artist_cv_file_path, artist_cv_uploaded_at';

/**
 * When a claim merges an unclaimed artist profile into the artist's existing
 * profile (e.g. a duplicate someone added before the artist joined), copy the
 * content people contributed into the artist's profile without overwriting
 * anything the artist wrote, and move the contribution log with it.
 *
 * Best-effort: logs and returns false on failure rather than blocking the claim.
 */
export async function carryOverArtistProfileContent(
  db: UntypedSupabaseClient,
  fromProfileId: string,
  toProfileId: string,
): Promise<{ ok: boolean; fields: string[] }> {
  if (!fromProfileId || !toProfileId || fromProfileId === toProfileId) return { ok: true, fields: [] };
  try {
    const { data, error } = await db.from('user_profiles').select(CONTENT_COLUMNS).in('id', [fromProfileId, toProfileId]);
    if (error) throw error;
    const rows = (data ?? []) as (CarryOverProfile & { id: string })[];
    const from = rows.find((r) => r.id === fromProfileId);
    const to = rows.find((r) => r.id === toProfileId);
    if (!from || !to) return { ok: false, fields: [] };

    const update = buildCarryOverUpdate(from, to);
    const fields = Object.keys(update);
    if (fields.length > 0) {
      const { error: updateError } = await db
        .from('user_profiles')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', toProfileId);
      if (updateError) throw updateError;
    }

    const { error: logError } = await db
      .from('artist_profile_contributions')
      .update({ profile_id: toProfileId })
      .eq('profile_id', fromProfileId);
    if (logError) logger.error('artist_profile_carry_over_log_move_failed', { fromProfileId, toProfileId, error: logError });

    console.log('[ArtistContent] carried over contributed content', { fromProfileId, toProfileId, fields });
    return { ok: true, fields };
  } catch (error) {
    logger.error('artist_profile_carry_over_failed', { fromProfileId, toProfileId, error });
    return { ok: false, fields: [] };
  }
}
