import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

/**
 * Walk source_artwork_id links between certificates of the same physical work
 * (artist CoA → gallery CoS → collector COO). Bounded so a bad cycle can't loop.
 */
const MAX_DEPTH = 5;

/** The given ids plus every certificate they were issued from. */
export async function loadAncestorIds(admin: UntypedSupabaseClient, ids: string[]): Promise<Map<string, string>> {
  // ancestor id → the starting id it belongs to
  const owner = new Map<string, string>(ids.map((id) => [id, id]));
  let frontier = ids;

  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const { data, error } = await admin
      .from('artworks')
      .select('id, source_artwork_id')
      .in('id', frontier)
      .not('source_artwork_id', 'is', null);
    if (error) {
      console.error('[Collectors] loadAncestorIds failed', error);
      break;
    }
    const next: string[] = [];
    for (const row of (data ?? []) as Array<{ id: string; source_artwork_id: string }>) {
      if (owner.has(row.source_artwork_id)) continue;
      owner.set(row.source_artwork_id, owner.get(row.id)!);
      next.push(row.source_artwork_id);
    }
    frontier = next;
  }
  return owner;
}

export interface ChainRow {
  id: string;
  account_id: string | null;
  certificate_type: string | null;
  title: string | null;
}

/** The given ids plus every certificate issued from them, with their owners. */
export async function loadDescendants(
  admin: UntypedSupabaseClient,
  ids: string[],
): Promise<Array<ChainRow>> {
  const seen = new Set(ids);
  const result: Array<ChainRow> = [];

  const { data: roots } = await admin.from('artworks').select('id, account_id, certificate_type, title').in('id', ids);
  result.push(...((roots ?? []) as Array<ChainRow>));

  let frontier = ids;
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const { data, error } = await admin
      .from('artworks')
      .select('id, account_id, certificate_type, title')
      .in('source_artwork_id', frontier);
    if (error) {
      console.error('[Collectors] loadDescendants failed', error);
      break;
    }
    const next: string[] = [];
    for (const row of (data ?? []) as Array<ChainRow>) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      result.push(row);
      next.push(row.id);
    }
    frontier = next;
  }
  return result;
}
