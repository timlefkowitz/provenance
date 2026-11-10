import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';

export type ManagerContext = {
  userId: string;
  admin: UntypedSupabaseClient;
  exhibition: { id: string; gallery_id: string; title: string | null; published_at: string | null };
};

/**
 * Signed-in user who can manage the exhibition, plus an admin client.
 * Returns an error message instead of throwing so actions can pass it on.
 */
export async function requireExhibitionManager(
  exhibitionId: string,
): Promise<{ ok: true; ctx: ManagerContext } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to manage this exhibition.' };
  if (!exhibitionId) return { ok: false, error: 'Exhibition not found.' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('id, gallery_id, title, published_at')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (!exhibition) return { ok: false, error: 'Exhibition not found.' };
  if (!(await canManageExhibition(user.id, exhibition.gallery_id))) {
    return { ok: false, error: 'Only people who manage this exhibition can do that.' };
  }
  return { ok: true, ctx: { userId: user.id, admin, exhibition } };
}
