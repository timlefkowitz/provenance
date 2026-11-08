import { asUntyped } from '~/lib/supabase-untyped';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';
import {
  appendLineIfMissing as appendIfMissing,
  collectChainArtworkIds,
  findRootId,
  transferOwnershipAcrossChain,
} from '~/lib/provenance/chain';

export type LinkedCertEventKind = 'coo_issued' | 'cos_issued' | 'coa_issued';

function formatDateLine(): string {
  return new Date().toISOString().slice(0, 10);
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
      const { error: insertEvErr } = await asUntyped(adminClient)
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

      const { data: row, error: fetchErr } = await asUntyped(adminClient)
        .from('artworks')
        .select('former_owners, exhibition_history, historic_context')
        .eq('id', artworkId)
        .maybeSingle();

      if (fetchErr || !row) {
        continue;
      }

      const former_owners = row.former_owners as string | null;
      let exhibition_history = row.exhibition_history as string | null;
      let historic_context = row.historic_context as string | null;

      if (eventKind === 'coo_issued') {
        // Ownership is handled below: the buyer becomes "Owned by" on every
        // certificate and the previous owner moves into former owners.
        continue;
      } else if (eventKind === 'cos_issued') {
        const line = `${actorDisplayName}, ${dateStr}`;
        exhibition_history = appendIfMissing(exhibition_history, line);
      } else if (eventKind === 'coa_issued') {
        const line = `Certificate of Authenticity linked (${dateStr})`;
        historic_context = appendIfMissing(historic_context, line);
      }

      const { error: updErr } = await asUntyped(adminClient)
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

    if (eventKind === 'coo_issued') {
      await transferOwnershipAcrossChain(adminClient, {
        originArtworkId: newArtworkId,
        newOwnerName: actorDisplayName,
        method: 'ownership_accepted',
        actorAccountId,
        actorName: actorDisplayName,
        notify: false, // the notification below covers it
      });
    }

    const accountIds = new Set<string>();
    for (const artworkId of chainIds) {
      const { data: a } = await asUntyped(adminClient)
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
  const { data } = await asUntyped(adminClient)
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
