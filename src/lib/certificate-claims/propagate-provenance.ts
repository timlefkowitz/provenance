import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';

export type LinkedCertEventKind = 'coo_issued' | 'cos_issued' | 'coa_issued';

function formatDateLine(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Find the root certificate ID using the precomputed chain_root_id column.
 * Falls back to traversal if chain_root_id is not yet populated.
 */
async function findRootId(
  adminClient: SupabaseClient,
  artworkId: string,
): Promise<string> {
  // First, try to use the precomputed chain_root_id
  const { data, error } = await (adminClient as any)
    .from('artworks')
    .select('id, chain_root_id, source_artwork_id')
    .eq('id', artworkId)
    .maybeSingle();

  if (error || !data) {
    return artworkId;
  }

  // If chain_root_id is set, use it directly (O(1) lookup)
  if (data.chain_root_id) {
    return data.chain_root_id as string;
  }

  // If no source_artwork_id, this is the root
  if (!data.source_artwork_id) {
    return data.id as string;
  }

  // Fallback: traverse for legacy data (will be removed after backfill)
  let current = data.source_artwork_id as string;
  for (let i = 0; i < 64; i++) {
    const { data: parent, error: parentErr } = await (adminClient as any)
      .from('artworks')
      .select('id, source_artwork_id, chain_root_id')
      .eq('id', current)
      .maybeSingle();

    if (parentErr || !parent) {
      return current;
    }

    // Check if this parent has chain_root_id computed
    if (parent.chain_root_id) {
      return parent.chain_root_id as string;
    }

    if (!parent.source_artwork_id) {
      return parent.id as string;
    }

    current = parent.source_artwork_id as string;
  }

  return current;
}

/**
 * Get all artwork IDs in the certificate chain using chain_root_id.
 * Falls back to recursive collection if chain_root_id is not populated.
 */
async function collectChainArtworkIds(
  adminClient: SupabaseClient,
  rootId: string,
): Promise<string[]> {
  // Try efficient query using chain_root_id
  const { data: chainData, error: chainErr } = await (adminClient as any)
    .from('artworks')
    .select('id')
    .or(`id.eq.${rootId},chain_root_id.eq.${rootId}`);

  if (!chainErr && chainData && chainData.length > 0) {
    return chainData.map((row: { id: string }) => row.id);
  }

  // Fallback: recursive collection for legacy data
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
 * Batch insert provenance events with deduplication.
 * Uses ON CONFLICT to skip duplicates based on artwork_id + event_type + related_artwork_id.
 */
async function batchInsertProvenanceEvents(
  adminClient: SupabaseClient,
  chainIds: string[],
  params: {
    eventType: LinkedCertEventKind;
    newArtworkId: string;
    actorAccountId: string;
    actorDisplayName: string;
    rootId: string;
  },
): Promise<void> {
  const { eventType, newArtworkId, actorAccountId, actorDisplayName, rootId } = params;

  // Build batch of events
  const events = chainIds.map((artworkId) => ({
    artwork_id: artworkId,
    event_type: eventType,
    actor_account_id: actorAccountId,
    actor_name: actorDisplayName,
    related_artwork_id: newArtworkId,
    metadata: { propagated: true, chain_root_id: rootId },
  }));

  // Batch insert with upsert to handle deduplication
  // Using ignoreDuplicates to skip if the same event already exists
  const { error } = await (adminClient as any)
    .from('provenance_events')
    .upsert(events, {
      onConflict: 'artwork_id,event_type,related_artwork_id',
      ignoreDuplicates: true,
    });

  if (error) {
    // If upsert fails (e.g., index doesn't exist yet), fall back to individual inserts
    logger.warn('propagate_provenance_batch_upsert_failed, falling back to individual inserts', {
      error,
    });
    for (const event of events) {
      const { error: insertErr } = await (adminClient as any)
        .from('provenance_events')
        .insert(event);

      if (insertErr && !insertErr.message?.includes('duplicate')) {
        logger.error('propagate_provenance_event_insert_failed', {
          artworkId: event.artwork_id,
          error: insertErr,
        });
      }
    }
  }
}

/**
 * Batch update legacy text fields on all certificates in the chain.
 */
async function batchUpdateLegacyTextFields(
  adminClient: SupabaseClient,
  chainIds: string[],
  params: {
    eventKind: LinkedCertEventKind;
    actorDisplayName: string;
  },
): Promise<void> {
  const { eventKind, actorDisplayName } = params;
  const dateStr = formatDateLine();

  // Fetch all artworks in the chain with their current text fields
  const { data: artworks, error: fetchErr } = await (adminClient as any)
    .from('artworks')
    .select('id, former_owners, exhibition_history, historic_context')
    .in('id', chainIds);

  if (fetchErr || !artworks) {
    logger.error('propagate_provenance_fetch_artworks_failed', { error: fetchErr });
    return;
  }

  // Prepare updates based on event kind
  const updates: Array<{
    id: string;
    former_owners?: string;
    exhibition_history?: string;
    historic_context?: string;
  }> = [];

  for (const row of artworks) {
    const artwork = row as {
      id: string;
      former_owners: string | null;
      exhibition_history: string | null;
      historic_context: string | null;
    };

    let former_owners = artwork.former_owners;
    let exhibition_history = artwork.exhibition_history;
    let historic_context = artwork.historic_context;
    let needsUpdate = false;

    if (eventKind === 'coo_issued') {
      const line = `${actorDisplayName} (${dateStr})`;
      const newValue = appendIfMissing(former_owners, line);
      if (newValue !== (former_owners ?? '').trim()) {
        former_owners = newValue;
        needsUpdate = true;
      }
    } else if (eventKind === 'cos_issued') {
      const line = `${actorDisplayName}, ${dateStr}`;
      const newValue = appendIfMissing(exhibition_history, line);
      if (newValue !== (exhibition_history ?? '').trim()) {
        exhibition_history = newValue;
        needsUpdate = true;
      }
    } else if (eventKind === 'coa_issued') {
      const line = `Certificate of Authenticity linked (${dateStr})`;
      const newValue = appendIfMissing(historic_context, line);
      if (newValue !== (historic_context ?? '').trim()) {
        historic_context = newValue;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      updates.push({
        id: artwork.id,
        former_owners: former_owners ?? undefined,
        exhibition_history: exhibition_history ?? undefined,
        historic_context: historic_context ?? undefined,
      });
    }
  }

  // Execute updates in parallel (Supabase doesn't support true batch update)
  await Promise.all(
    updates.map(async (update) => {
      const { error: updErr } = await (adminClient as any)
        .from('artworks')
        .update({
          former_owners: update.former_owners,
          exhibition_history: update.exhibition_history,
          historic_context: update.historic_context,
        })
        .eq('id', update.id);

      if (updErr) {
        logger.error('propagate_provenance_text_mirror_failed', {
          artworkId: update.id,
          error: updErr,
        });
      }
    }),
  );
}

/**
 * Batch fetch account IDs from chain and send notifications.
 */
async function sendChainNotifications(
  adminClient: SupabaseClient,
  chainIds: string[],
  params: {
    eventKind: LinkedCertEventKind;
    newArtworkId: string;
    actorAccountId: string;
    actorDisplayName: string;
    rootId: string;
  },
): Promise<void> {
  const { eventKind, newArtworkId, actorAccountId, actorDisplayName, rootId } = params;

  // Fetch all account IDs in one query
  const { data: artworks, error } = await (adminClient as any)
    .from('artworks')
    .select('account_id')
    .in('id', chainIds);

  if (error || !artworks) {
    logger.error('propagate_provenance_fetch_accounts_failed', { error });
    return;
  }

  // Deduplicate account IDs, excluding the actor
  const accountIds = new Set<string>();
  for (const row of artworks) {
    const acc = (row as { account_id: string | null })?.account_id;
    if (acc && acc !== actorAccountId) {
      accountIds.add(acc);
    }
  }

  // Send notifications in parallel
  await Promise.all(
    [...accountIds].map(async (uid) => {
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
    }),
  );
}

/**
 * After a linked certificate is created, record structured events on every certificate
 * in the same provenance tree and mirror into legacy text fields.
 *
 * Optimized version:
 * - Uses chain_root_id for O(1) root lookup
 * - Batch inserts provenance events with deduplication
 * - Parallel updates for legacy text fields
 * - Single query for account IDs
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
    // Step 1: Find the root certificate (O(1) with chain_root_id)
    const rootId = await findRootId(adminClient, newArtworkId);

    // Step 2: Get all certificates in the chain
    const chainIds = await collectChainArtworkIds(adminClient, rootId);

    console.log('[Provenance] Chain collected', { rootId, chainCount: chainIds.length });

    // Step 3: Batch insert provenance events with deduplication
    await batchInsertProvenanceEvents(adminClient, chainIds, {
      eventType: eventKind,
      newArtworkId,
      actorAccountId,
      actorDisplayName,
      rootId,
    });

    // Step 4: Batch update legacy text fields
    await batchUpdateLegacyTextFields(adminClient, chainIds, {
      eventKind,
      actorDisplayName,
    });

    // Step 5: Send notifications to all certificate holders (except actor)
    await sendChainNotifications(adminClient, chainIds, {
      eventKind,
      newArtworkId,
      actorAccountId,
      actorDisplayName,
      rootId,
    });

    console.log('[Provenance] propagateProvenanceAfterLinkedCertificate completed', {
      eventKind,
      newArtworkId,
      chainCount: chainIds.length,
    });
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

/**
 * Create certificate link entries for bidirectional queries.
 * Call this when creating a new linked certificate.
 */
export async function createCertificateLinks(
  adminClient: SupabaseClient,
  params: {
    newArtworkId: string;
    sourceArtworkId: string;
    rootId: string;
  },
): Promise<void> {
  const { newArtworkId, sourceArtworkId, rootId } = params;

  // Create parent link (new → source)
  await (adminClient as any).from('certificate_links').upsert(
    {
      source_artwork_id: newArtworkId,
      linked_artwork_id: sourceArtworkId,
      link_type: 'parent',
    },
    { onConflict: 'source_artwork_id,linked_artwork_id,link_type', ignoreDuplicates: true },
  );

  // Create child link (source → new)
  await (adminClient as any).from('certificate_links').upsert(
    {
      source_artwork_id: sourceArtworkId,
      linked_artwork_id: newArtworkId,
      link_type: 'child',
    },
    { onConflict: 'source_artwork_id,linked_artwork_id,link_type', ignoreDuplicates: true },
  );

  // Find siblings (other children of the same root) and create sibling links
  const { data: siblings } = await (adminClient as any)
    .from('artworks')
    .select('id')
    .eq('chain_root_id', rootId)
    .neq('id', newArtworkId);

  if (siblings && siblings.length > 0) {
    const siblingLinks = siblings.flatMap((s: { id: string }) => [
      {
        source_artwork_id: newArtworkId,
        linked_artwork_id: s.id,
        link_type: 'sibling',
      },
      {
        source_artwork_id: s.id,
        linked_artwork_id: newArtworkId,
        link_type: 'sibling',
      },
    ]);

    await (adminClient as any).from('certificate_links').upsert(siblingLinks, {
      onConflict: 'source_artwork_id,linked_artwork_id,link_type',
      ignoreDuplicates: true,
    });
  }
}

/**
 * Get all linked certificates for a given artwork.
 */
export async function getLinkedCertificates(
  adminClient: SupabaseClient,
  artworkId: string,
  options?: { linkType?: 'parent' | 'child' | 'sibling' | 'all' },
): Promise<
  Array<{
    id: string;
    linkedArtworkId: string;
    linkType: string;
    artwork: {
      id: string;
      title: string;
      certificate_type: string;
      account_id: string;
    } | null;
  }>
> {
  const linkType = options?.linkType ?? 'all';

  let query = (adminClient as any)
    .from('certificate_links')
    .select(
      `
      id,
      linked_artwork_id,
      link_type,
      artwork:linked_artwork_id (
        id,
        title,
        certificate_type,
        account_id
      )
    `,
    )
    .eq('source_artwork_id', artworkId);

  if (linkType !== 'all') {
    query = query.eq('link_type', linkType);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('get_linked_certificates_failed', { artworkId, error });
    return [];
  }

  return (data ?? []).map(
    (row: {
      id: string;
      linked_artwork_id: string;
      link_type: string;
      artwork: { id: string; title: string; certificate_type: string; account_id: string } | null;
    }) => ({
      id: row.id,
      linkedArtworkId: row.linked_artwork_id,
      linkType: row.link_type,
      artwork: row.artwork,
    }),
  );
}
