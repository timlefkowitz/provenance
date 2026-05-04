'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { validateSiteHandle } from '~/lib/gallery-public-slug';

export type HandleValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

/**
 * Validate and check availability of a site handle.
 * Returns ok=false with an error string if the handle is invalid or taken.
 * currentProfileId is excluded from the uniqueness check (for re-saves).
 */
export async function validateHandleAction(
  raw: string,
  currentProfileId?: string,
): Promise<HandleValidationResult> {
  const formatResult = validateSiteHandle(raw);
  if (!formatResult.ok) return formatResult;

  const { normalized } = formatResult;

  const client = getSupabaseServerClient();
  const { data, error } = await (client as any)
    .from('profile_sites')
    .select('profile_id')
    .eq('handle', normalized)
    .maybeSingle();

  if (error) {
    console.error('[Sites] validateHandleAction DB check failed', error);
    return { ok: false, error: 'Could not check handle availability. Try again.' };
  }

  if (data && data.profile_id !== currentProfileId) {
    return { ok: false, error: 'That handle is already taken. Choose another.' };
  }

  return { ok: true, normalized };
}
