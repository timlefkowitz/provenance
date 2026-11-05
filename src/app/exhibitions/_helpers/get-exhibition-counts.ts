import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { isShownInExhibition } from './exhibition-submission-status';

export type ExhibitionCounts = {
  artworks: number;
  /** Of `artworks`, how many are still unpublished draft listings. */
  draftArtworks: number;
  artists: number;
};

const CHUNK = 200;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

function normalizeName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return trimmed || null;
}

/**
 * Artwork and artist counts for the exhibitions index, in a few batched queries.
 *
 * Counts what the owner sees on the exhibition page: selected works that are
 * published or still draft listings. Artists are the credited accounts plus the
 * distinct artists named on those works, so a work by an artist without an
 * account still counts once.
 *
 * Callers must only pass exhibition IDs the viewer can already see; this reads
 * through the service role so a team member's counts match the owner's.
 */
export async function getExhibitionCounts(
  exhibitionIds: string[],
): Promise<Record<string, ExhibitionCounts>> {
  const result: Record<string, ExhibitionCounts> = {};
  for (const id of exhibitionIds) result[id] = { artworks: 0, draftArtworks: 0, artists: 0 };
  if (exhibitionIds.length === 0) return result;

  const admin = asUntyped(getSupabaseServerAdminClient());

  const linkRows: Array<{ exhibition_id: string; artwork_id: string }> = [];
  const creditRows: Array<{ exhibition_id: string; artist_account_id: string; name: string | null }> = [];

  for (const ids of chunks(exhibitionIds)) {
    const [links, credits] = await Promise.all([
      admin
        .from('exhibition_artworks')
        .select('exhibition_id, artwork_id, status')
        .in('exhibition_id', ids),
      admin
        .from('exhibition_artists')
        .select('exhibition_id, artist_account_id, accounts!exhibition_artists_artist_account_id_fkey (name)')
        .in('exhibition_id', ids),
    ]);
    if (links.error) console.error('[Exhibitions] getExhibitionCounts links failed', links.error);
    if (credits.error) console.error('[Exhibitions] getExhibitionCounts credits failed', credits.error);

    for (const row of links.data ?? []) {
      if (isShownInExhibition(row.status)) {
        linkRows.push({ exhibition_id: row.exhibition_id, artwork_id: row.artwork_id });
      }
    }
    for (const row of credits.data ?? []) {
      creditRows.push({
        exhibition_id: row.exhibition_id,
        artist_account_id: row.artist_account_id,
        name: (row.accounts as { name?: string | null } | null)?.name ?? null,
      });
    }
  }

  const artworkIds = Array.from(new Set(linkRows.map((l) => l.artwork_id)));
  const artworks = new Map<
    string,
    { status: string; accountId: string | null; profileId: string | null; name: string | null }
  >();
  for (const ids of chunks(artworkIds)) {
    const { data, error } = await admin
      .from('artworks')
      .select('id, status, artist_name, artist_account_id, artist_profile_id')
      .in('id', ids);
    if (error) console.error('[Exhibitions] getExhibitionCounts artworks failed', error);
    for (const a of data ?? []) {
      artworks.set(a.id, {
        status: a.status,
        accountId: a.artist_account_id ?? null,
        profileId: a.artist_profile_id ?? null,
        name: normalizeName(a.artist_name),
      });
    }
  }

  // A name seen on an account-linked work or a credit resolves to that account,
  // so the same artist isn't counted once by account and again by name.
  const accountByName = new Map<string, string>();
  for (const c of creditRows) {
    const n = normalizeName(c.name);
    if (n && c.artist_account_id) accountByName.set(n, c.artist_account_id);
  }
  for (const a of artworks.values()) {
    if (a.name && a.accountId && !accountByName.has(a.name)) accountByName.set(a.name, a.accountId);
  }

  const artistKeys = new Map<string, Set<string>>();
  const keysFor = (exhibitionId: string) => {
    let set = artistKeys.get(exhibitionId);
    if (!set) {
      set = new Set();
      artistKeys.set(exhibitionId, set);
    }
    return set;
  };

  for (const c of creditRows) {
    if (c.artist_account_id) keysFor(c.exhibition_id).add(`a:${c.artist_account_id}`);
  }

  for (const link of linkRows) {
    const art = artworks.get(link.artwork_id);
    if (!art || (art.status !== 'verified' && art.status !== 'draft')) continue;
    const counts = result[link.exhibition_id];
    if (!counts) continue;
    counts.artworks += 1;
    if (art.status === 'draft') counts.draftArtworks += 1;

    const accountId = art.accountId ?? (art.name ? accountByName.get(art.name) : undefined);
    const key = accountId
      ? `a:${accountId}`
      : art.name
        ? `n:${art.name}`
        : art.profileId
          ? `p:${art.profileId}`
          : null;
    if (key) keysFor(link.exhibition_id).add(key);
  }

  for (const [exhibitionId, keys] of artistKeys) {
    const counts = result[exhibitionId];
    if (counts) counts.artists = keys.size;
  }

  return result;
}
