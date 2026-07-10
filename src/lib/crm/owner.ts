import { asUntyped, UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Resolves the artist_user_id to use for CRM operations:
 * - If the current user has their own artist profile, returns their own id.
 * - If they are a crm_member for another artist, returns that artist's id.
 * - Falls back to the caller's own id (RLS will enforce access).
 */
export async function resolveArtistUserId(
  client: UntypedSupabaseClient,
  userId: string,
): Promise<string> {
  const { data: artistProfile } = await asUntyped(client)
    .from('user_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'artist')
    .maybeSingle();

  if (artistProfile) return userId;

  const { data: membership } = await asUntyped(client)
    .from('crm_members')
    .select('artist_user_id')
    .eq('member_user_id', userId)
    .limit(1)
    .maybeSingle();

  return membership?.artist_user_id ?? userId;
}
