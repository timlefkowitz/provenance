'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';

export type TransferHandleResult =
  | { success: true; handle: string }
  | { success: false; error: string };

/**
 * Transfer a site handle (and its full config) from one profile to another.
 *
 * The caller must manage BOTH the source and destination profiles.
 * After transfer the source profile loses its profile_sites row entirely
 * (handle, theme, hero, artwork filters, etc. all move to the destination).
 */
export async function transferHandleAction(
  fromProfileId: string,
  toProfileId: string,
): Promise<TransferHandleResult> {
  console.log('[Sites] transferHandleAction', { fromProfileId, toProfileId });

  if (fromProfileId === toProfileId) {
    return { success: false, error: 'Source and destination are the same profile.' };
  }

  const client = getSupabaseServerClient();
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const sb = client as any;

  // Verify access to both profiles
  async function canManageProfile(profileId: string): Promise<boolean> {
    const { data: p } = await sb
      .from('user_profiles')
      .select('id, user_id, role')
      .eq('id', profileId)
      .maybeSingle();
    if (!p) return false;
    if (p.user_id === user.id) return true;
    if (p.role === 'gallery') return canManageGallery(user.id, profileId);
    return false;
  }

  const [canFrom, canTo] = await Promise.all([
    canManageProfile(fromProfileId),
    canManageProfile(toProfileId),
  ]);

  if (!canFrom) {
    return { success: false, error: 'You do not have permission to manage the source profile.' };
  }
  if (!canTo) {
    return { success: false, error: 'You do not have permission to manage the destination profile.' };
  }

  // Read the source row
  const { data: sourceRow, error: readErr } = await sb
    .from('profile_sites')
    .select('*')
    .eq('profile_id', fromProfileId)
    .maybeSingle();

  if (readErr || !sourceRow) {
    console.error('[Sites] transferHandleAction source row not found', readErr);
    return { success: false, error: 'Source site config not found.' };
  }

  // Build the destination row — same config, new profile_id, reset published state
  const destRow = {
    ...sourceRow,
    profile_id: toProfileId,
    // Carry over published state so a live site stays live after transfer
    updated_at: new Date().toISOString(),
  };

  // Delete source, insert dest in a logical sequence.
  // Postgres won't let us UPDATE the PK, so delete + insert.
  const { error: delErr } = await sb
    .from('profile_sites')
    .delete()
    .eq('profile_id', fromProfileId);

  if (delErr) {
    console.error('[Sites] transferHandleAction delete failed', delErr);
    return { success: false, error: `Transfer failed: ${delErr.message}` };
  }

  // If the destination already has a site row (different handle), we upsert on profile_id
  const { error: insertErr } = await sb
    .from('profile_sites')
    .upsert(destRow, { onConflict: 'profile_id' });

  if (insertErr) {
    console.error('[Sites] transferHandleAction insert failed', insertErr);
    // Best-effort: restore source row to avoid losing data
    await sb.from('profile_sites').insert(sourceRow).select();
    return { success: false, error: `Transfer failed: ${insertErr.message}` };
  }

  console.log('[Sites] transferHandleAction succeeded', { handle: sourceRow.handle, toProfileId });
  return { success: true, handle: sourceRow.handle };
}
