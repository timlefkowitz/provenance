import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

import type { OwnershipHolder } from './group-collectors';

/**
 * Holders of Certificates of Ownership issued from any of `artworkIds` (or
 * from a certificate one level below them, e.g. CoA → CoS → CoO). Each
 * holder's `artwork_id` is the id from `artworkIds` it descends from, so it
 * lines up with the sales loaded for those ids.
 */
export async function loadOwnershipHolders(
  admin: UntypedSupabaseClient,
  artworkIds: string[],
): Promise<OwnershipHolder[]> {
  if (!artworkIds.length) return [];
  try {
    const { data: children } = await admin
      .from('artworks')
      .select('id, source_artwork_id, certificate_type, account_id, created_at')
      .in('source_artwork_id', artworkIds);
    const level1 = (children ?? []) as Array<{
      id: string;
      source_artwork_id: string;
      certificate_type: string | null;
      account_id: string;
      created_at: string;
    }>;

    const ancestorOf = new Map<string, string>();
    for (const c of level1) ancestorOf.set(c.id, c.source_artwork_id);

    const nonOwnerIds = level1.filter((c) => c.certificate_type !== 'ownership').map((c) => c.id);
    const { data: grand } = nonOwnerIds.length
      ? await admin
          .from('artworks')
          .select('id, source_artwork_id, certificate_type, account_id, created_at')
          .in('source_artwork_id', nonOwnerIds)
          .eq('certificate_type', 'ownership')
      : { data: [] };

    const coos = [
      ...level1
        .filter((c) => c.certificate_type === 'ownership')
        .map((c) => ({ ...c, root: c.source_artwork_id })),
      ...((grand ?? []) as typeof level1).map((g) => ({
        ...g,
        root: ancestorOf.get(g.source_artwork_id) ?? g.source_artwork_id,
      })),
    ];
    if (!coos.length) return [];

    const accountIds = Array.from(new Set(coos.map((c) => c.account_id)));
    const { data: accounts } = await admin.from('accounts').select('id, name, email').in('id', accountIds);
    const byId = new Map(
      ((accounts ?? []) as Array<{ id: string; name: string | null; email: string | null }>).map((a) => [a.id, a]),
    );

    return coos.map((c) => ({
      artwork_id: c.root,
      account_id: c.account_id,
      name: byId.get(c.account_id)?.name ?? null,
      email: byId.get(c.account_id)?.email ?? null,
      claimed_at: c.created_at,
    }));
  } catch (err) {
    console.error('[Collectors] loadOwnershipHolders failed', err);
    return [];
  }
}
