import { asUntyped } from '~/lib/supabase-untyped';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';

/**
 * A work's certificates (CoA, CoS, CoO) are separate `artworks` rows linked by
 * `source_artwork_id`, and each keeps its own copy of the provenance text.
 * These helpers keep those copies in step: a change on one certificate is
 * written to every certificate in the chain and tagged with where it came from.
 */

export type ProvenanceSyncMethod =
  | 'edit'
  | 'sale'
  | 'ownership_accepted'
  | 'ownership_transfer'
  | 'request_approved'
  | 'coo_issued'
  | 'cos_issued'
  | 'coa_issued'
  | 'backfill';

/** Provenance columns that are shared by every certificate of one work. */
export const SHARED_PROVENANCE_FIELDS = [
  'owned_by',
  'owned_by_is_public',
  'former_owners',
  'auction_history',
  'exhibition_history',
  'historic_context',
  'sold_by',
  'sold_by_is_public',
] as const;

export type SharedProvenanceField = (typeof SHARED_PROVENANCE_FIELDS)[number];
export type SharedProvenanceValues = Partial<Record<SharedProvenanceField, string | boolean | null>>;

/** Tag stored on a provenance_history entry written by a sync. */
export interface ProvenanceSyncTag {
  certificate_type: string | null;
  artwork_id: string;
  method: ProvenanceSyncMethod;
  actor_name: string | null;
}

const MAX_DEPTH = 64;
const HISTORY_CAP = 200;

export async function findRootId(adminClient: SupabaseClient, artworkId: string): Promise<string> {
  let current = artworkId;
  for (let i = 0; i < MAX_DEPTH; i++) {
    const { data, error } = await asUntyped(adminClient)
      .from('artworks')
      .select('id, source_artwork_id')
      .eq('id', current)
      .maybeSingle();
    if (error || !data) {
      return current;
    }
    const parent = data.source_artwork_id as string | null;
    if (!parent) {
      return data.id as string;
    }
    current = parent;
  }
  return current;
}

/** All artwork ids in the provenance tree from root (root + descendants via source_artwork_id). */
export async function collectChainArtworkIds(
  adminClient: SupabaseClient,
  rootId: string,
): Promise<string[]> {
  const chain = new Set<string>([rootId]);
  let frontier: string[] = [rootId];

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const { data: children, error } = await asUntyped(adminClient)
      .from('artworks')
      .select('id')
      .in('source_artwork_id', frontier);

    if (error) {
      logger.error('provenance_chain_collect_children_failed', { error, frontier });
      break;
    }

    const next: string[] = [];
    for (const row of children ?? []) {
      const id = (row as { id: string }).id;
      if (!chain.has(id)) {
        chain.add(id);
        next.push(id);
      }
    }
    if (next.length === 0) {
      break;
    }
    frontier = next;
  }

  return [...chain];
}

/** Every certificate id linked to `artworkId`, including itself. */
export async function getChainArtworkIds(
  adminClient: SupabaseClient,
  artworkId: string,
): Promise<{ rootId: string; ids: string[] }> {
  const rootId = await findRootId(adminClient, artworkId);
  const ids = await collectChainArtworkIds(adminClient, rootId);
  if (!ids.includes(artworkId)) ids.push(artworkId);
  return { rootId, ids };
}

export function appendLineIfMissing(existing: string | null | undefined, line: string): string {
  const base = (existing ?? '').trim();
  const add = line.trim();
  if (!add) return base;
  if (!base) return add;
  const lines = base.split('\n').map((l) => l.trim().toLowerCase());
  if (lines.some((l) => l === add.toLowerCase() || l.startsWith(`${add.toLowerCase()} (`))) {
    return base;
  }
  return `${base}\n${add}`;
}

/** Removes lines that name `name` (e.g. "Jane Doe (2026-11-07)") from a former-owners list. */
export function removeOwnerLine(existing: string | null | undefined, name: string): string | null {
  const target = name.trim().toLowerCase();
  if (!target) return existing ?? null;
  const kept = (existing ?? '')
    .split('\n')
    .filter((line) => {
      const l = line.trim().toLowerCase();
      return l && l !== target && !l.startsWith(`${target} (`) && !l.startsWith(`${target},`);
    });
  return kept.length ? kept.join('\n') : null;
}

/**
 * Next shared values after an ownership change: the current owner moves into
 * former owners (dated) and the new owner becomes "Owned by".
 * Pure — exported for tests.
 */
export function computeOwnershipTransfer(
  current: { owned_by?: string | null; former_owners?: string | null },
  newOwnerName: string,
  dateStr: string,
): { owned_by: string; former_owners: string | null } {
  const prev = (current.owned_by ?? '').trim();
  // A fuller name already on record (e.g. "Monica and Papillon Romero" for the
  // account "Papillon Romero") is kept rather than shortened.
  const next =
    prev && prev.toLowerCase().includes(newOwnerName.trim().toLowerCase()) ? prev : newOwnerName.trim();
  let former = removeOwnerLine(removeOwnerLine(current.former_owners, newOwnerName), next);
  if (prev && prev.toLowerCase() !== next.toLowerCase()) {
    former = appendLineIfMissing(former, `${prev} (until ${dateStr})`);
  }
  return { owned_by: next, former_owners: former || null };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Writes `fields` to every certificate in the chain of `originArtworkId`
 * (except the origin when `includeOrigin` is false), tagging each with a
 * provenance_history entry and a `provenance_synced` event, and notifies the
 * other holders. Best-effort: logs and never throws.
 */
export async function syncProvenanceAcrossChain(
  adminClient: SupabaseClient,
  params: {
    originArtworkId: string;
    fields: SharedProvenanceValues;
    method: ProvenanceSyncMethod;
    actorAccountId: string | null;
    actorName?: string | null;
    includeOrigin?: boolean;
    notify?: boolean;
  },
): Promise<{ syncedIds: string[] }> {
  const { originArtworkId, method, actorAccountId } = params;
  const fields = Object.fromEntries(
    Object.entries(params.fields).filter(
      ([k, v]) => v !== undefined && (SHARED_PROVENANCE_FIELDS as readonly string[]).includes(k),
    ),
  ) as SharedProvenanceValues;

  if (Object.keys(fields).length === 0) return { syncedIds: [] };

  try {
    const { rootId, ids } = await getChainArtworkIds(adminClient, originArtworkId);
    const targetIds = params.includeOrigin ? ids : ids.filter((id) => id !== originArtworkId);
    if (targetIds.length === 0) return { syncedIds: [] };

    const { data: origin } = await asUntyped(adminClient)
      .from('artworks')
      .select('certificate_type')
      .eq('id', originArtworkId)
      .maybeSingle();

    const tag: ProvenanceSyncTag = {
      certificate_type: (origin?.certificate_type as string | null) ?? null,
      artwork_id: originArtworkId,
      method,
      actor_name: params.actorName ?? null,
    };

    const { data: rows, error: rowsErr } = await asUntyped(adminClient)
      .from('artworks')
      .select(
        'id, account_id, provenance_history, owned_by, owned_by_is_public, former_owners, auction_history, exhibition_history, historic_context, sold_by, sold_by_is_public',
      )
      .in('id', targetIds);

    if (rowsErr) {
      logger.error('provenance_sync_fetch_failed', { originArtworkId, error: rowsErr });
      return { syncedIds: [] };
    }

    const now = new Date().toISOString();
    const synced: string[] = [];
    const holders = new Set<string>();

    type ChainRow = Record<string, unknown> & { id: string; account_id: string | null; provenance_history: unknown };
    for (const row of (rows ?? []) as unknown as ChainRow[]) {
      const previousValues: Record<string, unknown> = {};
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        const cur = (row as Record<string, unknown>)[k];
        if (String(cur ?? '') !== String(v ?? '')) {
          previousValues[k] = cur ?? null;
          update[k] = v;
        }
      }
      if (Object.keys(update).length === 0) continue;

      const history = Array.isArray(row.provenance_history) ? row.provenance_history : [];
      update.provenance_history = [
        ...history,
        { editedAt: now, editedBy: actorAccountId, previousValues, via: tag },
      ].slice(-HISTORY_CAP);
      if (actorAccountId) update.updated_by = actorAccountId;

      const { error: updErr } = await asUntyped(adminClient)
        .from('artworks')
        .update(update)
        .eq('id', row.id);
      if (updErr) {
        logger.error('provenance_sync_update_failed', { artworkId: row.id, error: updErr });
        continue;
      }
      synced.push(row.id as string);
      if (row.account_id && row.account_id !== actorAccountId) holders.add(row.account_id as string);

      const { error: evErr } = await asUntyped(adminClient)
        .from('provenance_events')
        .insert({
          artwork_id: row.id,
          event_type: 'provenance_synced',
          actor_account_id: actorAccountId,
          actor_name: params.actorName ?? null,
          related_artwork_id: originArtworkId,
          metadata: {
            via: tag.certificate_type,
            method,
            chain_root_id: rootId,
            changed_fields: Object.keys(previousValues),
          },
        });
      if (evErr) {
        logger.error('provenance_sync_event_failed', { artworkId: row.id, error: evErr });
      }
    }

    if (params.notify !== false) {
      // The artist hears about every change to their work's provenance, even
      // when they no longer hold a certificate in the chain.
      const artistId = await findArtistAccountId(adminClient, rootId);
      const artistIsHolder = !!artistId && holders.has(artistId);
      if (artistId && artistId !== actorAccountId && synced.length > 0) {
        holders.delete(artistId);
        try {
          const { data: work } = await asUntyped(adminClient)
            .from('artworks')
            .select('title')
            .eq('id', rootId)
            .maybeSingle();
          const title = (work?.title as string | null) || 'your artwork';
          const changed = describeChangedFields(Object.keys(fields));
          await createNotification({
            userId: artistId,
            type: 'provenance_updated',
            title: `Provenance updated for "${title}"`,
            message: `${params.actorName ?? 'A certificate holder'} updated the ${changed} of "${title}". The change is now on every certificate of the work.`,
            artworkId: rootId,
            relatedUserId: actorAccountId ?? undefined,
            metadata: { method, via: tag.certificate_type, chain_root_id: rootId, artist: true, was_holder: artistIsHolder },
          });
        } catch (e) {
          logger.error('provenance_sync_artist_notify_failed', { userId: artistId, error: e });
        }
      }
      for (const uid of holders) {
        try {
          await createNotification({
            userId: uid,
            type: 'provenance_updated',
            title: 'Provenance updated on linked certificates',
            message: `${params.actorName ?? 'A linked certificate holder'} updated the provenance of a work you hold a certificate for.`,
            artworkId: originArtworkId,
            relatedUserId: actorAccountId ?? undefined,
            metadata: { method, via: tag.certificate_type, chain_root_id: rootId },
          });
        } catch (e) {
          logger.error('provenance_sync_notify_failed', { userId: uid, error: e });
        }
      }
    }

    return { syncedIds: synced };
  } catch (err) {
    logger.error('provenance_sync_failed', { originArtworkId, error: err });
    return { syncedIds: [] };
  }
}

const FIELD_LABELS: Record<SharedProvenanceField, string> = {
  owned_by: 'owner',
  owned_by_is_public: 'owner privacy',
  former_owners: 'former owners',
  auction_history: 'sale history',
  exhibition_history: 'exhibition history',
  historic_context: 'historic context',
  sold_by: 'seller',
  sold_by_is_public: 'seller privacy',
};

/** "owner and former owners" — the provenance fields a sync touched. Pure. */
export function describeChangedFields(fields: string[]): string {
  const labels = [
    ...new Set(
      fields
        .filter((f): f is SharedProvenanceField => f in FIELD_LABELS)
        .filter((f) => !f.endsWith('_is_public'))
        .map((f) => FIELD_LABELS[f]),
    ),
  ];
  if (labels.length === 0) return 'provenance';
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

/** The artist behind a chain: the root's artist_account_id, else the holder of a root CoA. */
async function findArtistAccountId(adminClient: SupabaseClient, rootId: string): Promise<string | null> {
  const { data } = await asUntyped(adminClient)
    .from('artworks')
    .select('account_id, artist_account_id, certificate_type')
    .eq('id', rootId)
    .maybeSingle();
  if (!data) return null;
  return (
    (data.artist_account_id as string | null) ??
    (data.certificate_type === 'authenticity' ? (data.account_id as string | null) : null)
  );
}

/**
 * Sets the new owner on every certificate in the chain (including the origin):
 * the previous "Owned by" moves into former owners, dated.
 */
export async function transferOwnershipAcrossChain(
  adminClient: SupabaseClient,
  params: {
    originArtworkId: string;
    newOwnerName: string;
    method: ProvenanceSyncMethod;
    actorAccountId: string | null;
    actorName?: string | null;
    /** Owner value before the change, when the origin row was already updated. */
    previousOwnerName?: string | null;
    notify?: boolean;
  },
): Promise<{ syncedIds: string[] }> {
  const newOwner = params.newOwnerName.trim();
  if (!newOwner) return { syncedIds: [] };

  const { data: origin } = await asUntyped(adminClient)
    .from('artworks')
    .select('owned_by, former_owners')
    .eq('id', params.originArtworkId)
    .maybeSingle();

  const current = {
    owned_by: params.previousOwnerName !== undefined ? params.previousOwnerName : (origin?.owned_by as string | null),
    former_owners: origin?.former_owners as string | null,
  };
  const next = computeOwnershipTransfer(current, newOwner, todayStr());

  return syncProvenanceAcrossChain(adminClient, {
    originArtworkId: params.originArtworkId,
    fields: next,
    method: params.method,
    actorAccountId: params.actorAccountId,
    actorName: params.actorName,
    includeOrigin: true,
    notify: params.notify,
  });
}
