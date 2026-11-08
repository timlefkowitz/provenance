import 'server-only';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

/** A public profile page for a show's curator (exhibitions.metadata.curator). */
export type CuratorLink = { name: string; href: string };

type ProfileRow = { id: string; user_id: string | null; role: string; is_active: boolean | null };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function profileHref(p: ProfileRow): string {
  // Unclaimed profiles live at /artists/<profileId>; claimed ones under the account.
  return p.user_id
    ? `/artists/${p.user_id}?role=${p.role}&profileId=${p.id}`
    : `/artists/${p.id}`;
}

/**
 * Resolve a curator's free-text name to a profile link. The show owner's own
 * profile with that name wins (a gallerist curating their own show); otherwise
 * link only when exactly one active artist profile carries the name, so a
 * common name never points at the wrong person.
 */
export async function resolveCuratorLink(
  curatorName: string | null | undefined,
  ownerAccountId: string | null | undefined,
): Promise<CuratorLink | null> {
  const name = curatorName?.trim();
  if (!name) return null;

  try {
    const admin = asUntyped(getSupabaseServerAdminClient());
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, user_id, role, is_active')
      .ilike('name', escapeLike(name))
      .in('role', ['artist', 'collector'])
      .limit(20);
    if (error) {
      console.error('[Exhibitions] curator profile lookup failed', error);
      return null;
    }

    const rows = ((data ?? []) as ProfileRow[]).filter((p) => p.is_active !== false);

    if (ownerAccountId) {
      const own = rows.filter((p) => p.user_id === ownerAccountId);
      const pick = own.find((p) => p.role === 'artist') ?? own[0];
      if (pick) return { name, href: profileHref(pick) };
    }

    const artists = rows.filter((p) => p.role === 'artist');
    if (artists.length === 1) return { name, href: profileHref(artists[0]!) };
  } catch (err) {
    console.error('[Exhibitions] curator profile lookup threw', err);
  }
  return null;
}
