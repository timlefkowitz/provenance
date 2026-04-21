import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';

export type LinkedCertEventKind = 'coo_issued' | 'cos_issued' | 'coa_issued';

function formatDateLine(): string {
  return new Date().toISOString().slice(0, 10);
}

async function findRootId(
  adminClient: SupabaseClient,
  artworkId: string,
): Promise<string> {
  let current = artworkId;
  for (let i = 0; i < 64; i++) {
    const { data, error } = await (adminClient as any)
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

/**
 * All artwork ids in the provenance tree from root (root + descendants via source_artwork_id).
 */
async function collectChainArtworkIds(
  adminClient: SupabaseClient,
  rootId: string,
): Promise<string[]> {
  const chain = new Set<string>([rootId]);
  let frontier: string[] = [rootId];

  for (let depth = 0; depth < 64; depth++) {
    const { data: children, error } = await (adminClient as any)
      .from('artworks')
      .select('id')
      .in('source_artwork_id', frontier);

    if (error) {
      logger.error('propagate_collect_chain_children_failed', { error, frontier });
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

function appendIfMissing(existing: string | null | undefined, line: string): string {
  const base = (existing ?? '').trim();
  if (!base) {
    return line.trim();
  }
  if (base.includes(line.trim())) {
    return base;
  }
  return `${base}\n${line.trim()}`;
}

/**
 * After a linked certificate is created, record structured events on every certificate
 * in the same provenance tree and mirror into legacy text fields.
 */
export async function propagateProvenanceAfterLinkedCertificate(
  adminClient: SupabaseClient,
  params: {
    eventKind: LinkedCertEventKind;
    newArtworkId: string;
    actorAccountId: string;
    actorDisplayName: string;
  },
): Promise<void> {
  const { eventKind, newArtworkId, actorAccountId, actorDisplayName } = params;
  console.log('[Provenance] propagateProvenanceAfterLinkedCertificate started', {
    eventKind,
    newArtworkId,
  });

  try {
    const rootId = await findRootId(adminClient, newArtworkId);
    const chainIds = await collectChainArtworkIds(adminClient, rootId);
    const dateStr = formatDateLine();
    const dbEventType: 'coo_issued' | 'cos_issued' | 'coa_issued' = eventKind;

    for (const artworkId of chainIds) {
      const { error: insertEvErr } = await (adminClient as any)
        .from('provenance_events')
        .insert({
          artwork_id: artworkId,
          event_type: dbEventType,
          actor_account_id: actorAccountId,
          actor_name: actorDisplayName,
          related_artwork_id: newArtworkId,
          metadata: { propagated: true, chain_root_id: rootId },
        });

      if (insertEvErr) {
        logger.error('propagate_provenance_event_insert_failed', {
          artworkId,
          error: insertEvErr,
        });
      }

      const { data: row, error: fetchErr } = await (adminClient as any)
        .from('artworks')
        .select('former_owners, exhibition_history, historic_context')
        .eq('id', artworkId)
        .maybeSingle();

      if (fetchErr || !row) {
        continue;
      }

      let former_owners = row.former_owners as string | null;
      let exhibition_history = row.exhibition_history as string | null;
      let historic_context = row.historic_context as string | null;

      if (eventKind === 'coo_issued') {
        const line = `${actorDisplayName} (${dateStr})`;
        former_owners = appendIfMissing(former_owners, line);
      } else if (eventKind === 'cos_issued') {
        const line = `${actorDisplayName}, ${dateStr}`;
        exhibition_history = appendIfMissing(exhibition_history, line);
      } else if (eventKind === 'coa_issued') {
        const line = `Certificate of Authenticity linked (${dateStr})`;
        historic_context = appendIfMissing(historic_context, line);
      }

      const { error: updErr } = await (adminClient as any)
        .from('artworks')
        .update({
          former_owners,
          exhibition_history,
          historic_context,
        })
        .eq('id', artworkId);

      if (updErr) {
        logger.error('propagate_provenance_text_mirror_failed', { artworkId, error: updErr });
      }
    }

    const accountIds = new Set<string>();
    for (const artworkId of chainIds) {
      const { data: a } = await (adminClient as any)
        .from('artworks')
        .select('account_id')
        .eq('id', artworkId)
        .maybeSingle();
      const acc = a?.account_id as string | undefined;
      if (acc && acc !== actorAccountId) {
        accountIds.add(acc);
      }
    }

    for (const uid of accountIds) {
      try {
        await createNotification({
          userId: uid,
          type: 'provenance_updated',
          title: 'Provenance updated on linked certificates',
          message: `A related certificate action by ${actorDisplayName} was recorded across your linked provenance records.`,
          artworkId: newArtworkId,
          relatedUserId: actorAccountId,
          metadata: { event_kind: eventKind, chain_root_id: rootId },
        });
      } catch (e) {
        logger.error('propagate_provenance_notify_failed', { userId: uid, error: e });
      }
    }
  } catch (err) {
    console.error('[Provenance] propagateProvenanceAfterLinkedCertificate failed', err);
    logger.error('propagate_provenance_failed', { error: err });
  }
}

/**
 * Resolve a display name for an account (for provenance lines).
 */
export async function getAccountDisplayName(
  adminClient: SupabaseClient,
  accountId: string,
): Promise<string> {
  const { data } = await (adminClient as any)
    .from('accounts')
    .select('name')
    .eq('id', accountId)
    .maybeSingle();
  const name = (data?.name as string | null | undefined)?.trim();
  if (name) {
    return name;
  }
  return `Account ${accountId.slice(0, 8)}`;
}
