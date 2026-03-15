import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Returns the current user's active Artist subscription if any.
 * Used to gate Toolbox access (Grants, Open Calls, OR) for artists.
 * Certificates remain free for everyone.
 */
export async function getActiveArtistSubscription(userId: string): Promise<{
  id: string;
  role: string;
  status: string;
  current_period_end: string | null;
} | null> {
  const client = getSupabaseServerClient();
  const now = new Date().toISOString();
  const { data: rows } = await (client as any)
    .from('subscriptions')
    .select('id, role, status, current_period_end')
    .eq('user_id', userId)
    .eq('role', 'artist')
    .eq('status', 'active')
    .or(`current_period_end.is.null,current_period_end.gte.${now}`)
    .order('current_period_end', { ascending: false })
    .limit(1);

  const row = rows?.[0] ?? null;
  if (!row) return null;
  return row;
}
