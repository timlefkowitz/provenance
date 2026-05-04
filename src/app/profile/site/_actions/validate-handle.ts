'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { validateSiteHandle } from '~/lib/gallery-public-slug';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';

export type HandleValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string; takenByOwnProfile?: { profileId: string; profileName: string } };

/**
 * Validate and check availability of a site handle.
 *
 * - Rejects invalid format (reserved names, bad chars).
 * - If the handle is taken by the *same* profile (re-save), it's fine.
 * - If the handle is taken by *another profile the user manages*, returns
 *   ok=false with `takenByOwnProfile` so the editor can offer a transfer UI.
 * - If the handle is taken by someone else entirely, returns a plain error.
 */
export async function validateHandleAction(
  raw: string,
  currentProfileId?: string,
): Promise<HandleValidationResult> {
  const formatResult = validateSiteHandle(raw);
  if (!formatResult.ok) return formatResult;

  const { normalized } = formatResult;

  const client = getSupabaseServerClient();
  const sb = client as any;

  // Check who currently holds this handle
  const { data, error } = await sb
    .from('profile_sites')
    .select('profile_id')
    .eq('handle', normalized)
    .maybeSingle();

  if (error) {
    console.error('[Sites] validateHandleAction DB check failed', error);
    return { ok: false, error: 'Could not check handle availability. Try again.' };
  }

  // Available, or same profile re-saving
  if (!data || data.profile_id === currentProfileId) {
    return { ok: true, normalized };
  }

  // Handle is taken. Check if the current user also manages that profile.
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    return { ok: false, error: 'That handle is already taken. Choose another.' };
  }

  const conflictingProfileId: string = data.profile_id;

  // Check: does the user own or manage the conflicting profile?
  const { data: conflictProfile } = await sb
    .from('user_profiles')
    .select('id, name, user_id, role')
    .eq('id', conflictingProfileId)
    .maybeSingle();

  let userManagesConflict = conflictProfile?.user_id === user.id;
  if (!userManagesConflict && conflictProfile?.role === 'gallery') {
    userManagesConflict = await canManageGallery(user.id, conflictingProfileId);
  }

  if (userManagesConflict && conflictProfile) {
    return {
      ok: false,
      error: `"${normalized}" is linked to your ${conflictProfile.name} profile.`,
      takenByOwnProfile: {
        profileId: conflictingProfileId,
        profileName: conflictProfile.name,
      },
    };
  }

  return { ok: false, error: 'That handle is already taken. Choose another.' };
}
