import { after } from 'next/server';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

import type { NotificationType } from '~/lib/notifications';
import { USER_ROLES, type UserRole } from '~/lib/user-roles';

/** Roles whose uploads mean "new work is available", not an old work being catalogued. */
const ANNOUNCING_ROLES: UserRole[] = [USER_ROLES.ARTIST, USER_ROLES.GALLERY, USER_ROLES.INSTITUTION];
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * First look: tell an artist's followers as soon as new work by that artist is
 * posted, by the artist or by a gallery/institution showing them. One
 * notification per follower per artist per day, however many works were added.
 * Best-effort: never throws.
 */
export async function notifyArtistFollowers(params: {
  artworkIds: string[];
  posterUserId: string;
  posterRole: UserRole | null;
}): Promise<void> {
  if (!params.artworkIds.length || !params.posterRole || !ANNOUNCING_ROLES.includes(params.posterRole)) return;
  const admin = asUntyped(getSupabaseServerAdminClient());

  try {
    const { data: artworks } = await admin
      .from('artworks')
      .select('id, title, artist_account_id, artist_name')
      .in('id', params.artworkIds)
      .not('artist_account_id', 'is', null);
    const byArtist = new Map<string, Array<{ id: string; title: string | null; artist_name: string | null }>>();
    for (const a of (artworks ?? []) as Array<{
      id: string;
      title: string | null;
      artist_account_id: string;
      artist_name: string | null;
    }>) {
      if (!byArtist.has(a.artist_account_id)) byArtist.set(a.artist_account_id, []);
      byArtist.get(a.artist_account_id)!.push(a);
    }
    if (!byArtist.size) return;

    const isArtistPosting = params.posterRole === USER_ROLES.ARTIST;
    let posterName: string | null = null;
    if (!isArtistPosting) {
      const { data: profile } = await admin
        .from('user_profiles')
        .select('name')
        .eq('user_id', params.posterUserId)
        .eq('role', params.posterRole)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      posterName = profile?.name ?? null;
      if (!posterName) {
        const { data: account } = await admin.from('accounts').select('name').eq('id', params.posterUserId).maybeSingle();
        posterName = account?.name ?? null;
      }
    }

    const since = new Date(Date.now() - COOLDOWN_MS).toISOString();

    for (const [artistId, works] of byArtist) {
      // An artist only announces their own work.
      if (isArtistPosting && artistId !== params.posterUserId) continue;

      const { data: follows } = await admin
        .from('user_follows')
        .select('follower_id')
        .eq('following_id', artistId);
      const followerIds = ((follows ?? []) as Array<{ follower_id: string }>)
        .map((f) => f.follower_id)
        .filter((id) => id !== params.posterUserId && id !== artistId);
      if (!followerIds.length) continue;

      const { data: recent } = await admin
        .from('notifications')
        .select('user_id')
        .eq('type', 'new_work_by_followed_artist')
        .in('user_id', followerIds)
        .gte('created_at', since)
        .contains('metadata', { artist_account_id: artistId });
      const recentlyNotified = new Set(((recent ?? []) as Array<{ user_id: string }>).map((n) => n.user_id));

      const first = works[0]!;
      const artistName = first.artist_name || 'An artist you follow';
      const what = works.length === 1 ? `"${first.title ?? 'a new work'}"` : `${works.length} new works`;
      const message = posterName
        ? `${posterName} just added ${what} by ${artistName}. You're seeing it first because you follow them.`
        : `${artistName} just added ${what}. You're seeing it first because you follow them.`;

      const type: NotificationType = 'new_work_by_followed_artist';
      const rows = followerIds
        .filter((id) => !recentlyNotified.has(id))
        .map((followerId) => ({
          user_id: followerId,
          type,
          title: `New from ${artistName}`,
          message,
          artwork_id: first.id,
          related_user_id: artistId,
          metadata: {
            artist_account_id: artistId,
            poster_account_id: params.posterUserId,
            artwork_ids: works.map((w) => w.id),
          },
        }));
      if (!rows.length) continue;

      const { error } = await admin.from('notifications').insert(rows);
      if (error) {
        console.error('[Collectors] notifyArtistFollowers insert failed', error, { artistId });
        continue;
      }
      console.log('[Collectors] notifyArtistFollowers sent', { artistId, works: works.length, sent: rows.length });
    }
  } catch (err) {
    console.error('[Collectors] notifyArtistFollowers failed', err);
  }
}

/** Run notifyArtistFollowers after the response so uploads aren't held up by large follower lists. */
export function scheduleArtistFollowerNotifications(params: Parameters<typeof notifyArtistFollowers>[0]): void {
  if (!params.artworkIds.length) return;
  try {
    after(() => notifyArtistFollowers(params));
  } catch {
    // Outside a request scope (scripts, tests): run inline instead.
    void notifyArtistFollowers(params);
  }
}
