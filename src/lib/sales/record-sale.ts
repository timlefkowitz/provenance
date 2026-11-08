import { asUntyped } from '~/lib/supabase-untyped';
import type { SupabaseClient } from '@supabase/supabase-js';

import { refreshEntityStatsForAccounts } from '~/lib/stats/refresh-entity-stats';
import { transferOwnershipAcrossChain, type ProvenanceSyncMethod } from '~/lib/provenance/chain';
import { logger } from '~/lib/logger';

export interface RecordSaleBuyer {
  accountId?: string | null;
  email?: string | null;
  name?: string | null;
}

export interface RecordSaleInput {
  artworkId: string;
  buyer?: RecordSaleBuyer;
  priceCents?: number | null;
  currency?: string | null;
  soldAt?: string | null;
  notes?: string | null;
  soldByDisplay?: string | null;
  /** Who recorded it (null for webhooks / system). */
  recordedBy: string | null;
  /** Free-form; `source` says which path recorded the sale. */
  metadata?: Record<string, unknown> & { source: string };
  /** How the ownership change is tagged on linked certificates. */
  syncMethod?: ProvenanceSyncMethod;
}

export interface RecordSaleResult {
  success: boolean;
  error?: string;
  saleId?: string;
  sellerAccountId?: string;
  buyerAccountId?: string | null;
  buyerEmail?: string | null;
  buyerName?: string | null;
}

/**
 * The single place a sale is written: the artwork's sold columns, a
 * sales_ledger row, a 'sale' provenance event, the new owner mirrored across
 * linked certificates, and entity_stats for seller, buyer and artist.
 * Callers do their own permission checks. Uses the admin client.
 */
export async function recordSale(
  admin: SupabaseClient,
  input: RecordSaleInput,
): Promise<RecordSaleResult> {
  const db = asUntyped(admin);

  const { data: artwork, error: fetchError } = await db
    .from('artworks')
    .select('id, account_id, artist_account_id, title')
    .eq('id', input.artworkId)
    .single();

  if (fetchError || !artwork) {
    return { success: false, error: 'Artwork not found' };
  }

  const sellerAccountId = artwork.account_id as string;
  const soldAt = input.soldAt ?? new Date().toISOString();
  const currency = (input.currency ?? 'USD').toUpperCase();
  const priceCents =
    typeof input.priceCents === 'number' && Number.isFinite(input.priceCents)
      ? Math.round(input.priceCents)
      : null;

  const buyerAccountId = input.buyer?.accountId?.trim() || null;
  const buyerEmail = input.buyer?.email?.trim().toLowerCase() || null;
  const buyerName = input.buyer?.name?.trim() || null;

  const { error: updateError } = await db
    .from('artworks')
    .update({
      is_sold: true,
      sold_by_account_id: sellerAccountId,
      sold_to_account_id: buyerAccountId,
      sold_to_email: buyerEmail,
      sold_to_name: buyerName,
      sold_price_cents: priceCents,
      sold_currency: currency,
      sold_at: soldAt,
      ...(input.recordedBy ? { updated_by: input.recordedBy } : {}),
    })
    .eq('id', input.artworkId);

  if (updateError) {
    logger.error('record_sale_update_failed', { artworkId: input.artworkId, error: updateError });
    return { success: false, error: updateError.message || 'Failed to mark artwork as sold' };
  }

  let saleId: string | undefined;
  const { data: sale, error: saleError } = await db
    .from('sales_ledger')
    .insert({
      artwork_id: input.artworkId,
      sold_by_account_id: sellerAccountId,
      sold_to_account_id: buyerAccountId,
      sold_to_email: buyerEmail,
      sold_to_name: buyerName,
      price_cents: priceCents,
      currency,
      sold_at: soldAt,
      recorded_by: input.recordedBy,
      notes: input.notes ?? null,
      metadata: input.metadata ?? { source: 'unknown' },
    })
    .select('id')
    .single();
  if (saleError) {
    logger.error('record_sale_ledger_failed', { artworkId: input.artworkId, error: saleError });
  } else if (sale?.id) {
    saleId = sale.id as string;
  }

  const { error: eventError } = await db.from('provenance_events').insert({
    artwork_id: input.artworkId,
    event_type: 'sale',
    actor_account_id: input.recordedBy,
    event_date: soldAt,
    metadata: {
      source: input.metadata?.source ?? 'unknown',
      sold_by_display: input.soldByDisplay ?? null,
      sold_by_account_id: sellerAccountId,
      sold_to_account_id: buyerAccountId,
      sold_to_email: buyerEmail,
      sold_to_name: buyerName,
      price_cents: priceCents,
      currency,
      sale_id: saleId ?? null,
    },
  });
  if (eventError) {
    logger.error('record_sale_event_failed', { artworkId: input.artworkId, error: eventError });
  }

  if (buyerName) {
    await transferOwnershipAcrossChain(admin, {
      originArtworkId: input.artworkId,
      newOwnerName: buyerName,
      method: input.syncMethod ?? 'sale',
      actorAccountId: input.recordedBy,
      notify: false,
    });
  }

  await refreshStatsQuietly([sellerAccountId, buyerAccountId, artwork.artist_account_id as string | null]);

  return { success: true, saleId, sellerAccountId, buyerAccountId, buyerEmail, buyerName };
}

/**
 * Undoes a sale recorded by the `is_sold` toggle: clears the sold columns and
 * removes the ledger rows for this artwork that have no buyer (the ones the
 * toggle wrote). Sales with a named buyer are kept.
 */
export async function clearToggleSale(admin: SupabaseClient, artworkId: string): Promise<void> {
  const db = asUntyped(admin);
  const { data: artwork } = await db
    .from('artworks')
    .select('account_id, artist_account_id')
    .eq('id', artworkId)
    .maybeSingle();

  const { error: delErr } = await db
    .from('sales_ledger')
    .delete()
    .eq('artwork_id', artworkId)
    .is('sold_to_account_id', null)
    .is('sold_to_email', null)
    .is('sold_to_name', null)
    .eq('metadata->>source', 'sold_toggle');
  if (delErr) logger.error('clear_toggle_sale_ledger_failed', { artworkId, error: delErr });

  const { error: updErr } = await db
    .from('artworks')
    .update({ is_sold: false, sold_at: null })
    .eq('id', artworkId);
  if (updErr) logger.error('clear_toggle_sale_update_failed', { artworkId, error: updErr });

  await refreshStatsQuietly([
    artwork?.account_id as string | null,
    artwork?.artist_account_id as string | null,
  ]);
}

/**
 * After a buyer accepts a Certificate of Ownership: link them to the sale
 * already recorded on the source certificate, or record one if there is none.
 */
export async function ensureSaleForAcceptedOwnership(
  admin: SupabaseClient,
  params: {
    sourceArtworkId: string;
    buyerAccountId: string;
    buyerEmail: string | null;
    buyerName: string;
    inviteId: string;
  },
): Promise<{ created: boolean; linked: boolean }> {
  const db = asUntyped(admin);

  const { data: source } = await db
    .from('artworks')
    .select('id, is_sold, sold_at, sold_to_account_id, sold_to_email, sold_to_name, account_id, artist_account_id')
    .eq('id', params.sourceArtworkId)
    .maybeSingle();
  if (!source) return { created: false, linked: false };

  const { data: ledgerRows } = await db
    .from('sales_ledger')
    .select('id, sold_to_account_id, sold_to_email, sold_to_name')
    .eq('artwork_id', params.sourceArtworkId)
    .order('sold_at', { ascending: false })
    .limit(5);

  const emailLc = params.buyerEmail?.toLowerCase() ?? null;
  const ledger = ledgerRows ?? [];
  // Prefer the row for this buyer, else the latest row with no account on it.
  const match =
    ledger.find(
      (r) =>
        r.sold_to_account_id === params.buyerAccountId ||
        (emailLc && (r.sold_to_email as string | null)?.toLowerCase() === emailLc),
    ) ?? ledger.find((r) => !r.sold_to_account_id);

  if (source.is_sold || match) {
    if (match) {
      const { error } = await db
        .from('sales_ledger')
        .update({
          sold_to_account_id: params.buyerAccountId,
          sold_to_email: match.sold_to_email ?? params.buyerEmail,
          sold_to_name: match.sold_to_name ?? params.buyerName,
        })
        .eq('id', match.id);
      if (error) logger.error('ensure_sale_ledger_link_failed', { saleId: match.id, error });
    }
    const { error: artErr } = await db
      .from('artworks')
      .update({
        is_sold: true,
        sold_at: source.sold_at ?? new Date().toISOString(),
        sold_to_account_id: source.sold_to_account_id ?? params.buyerAccountId,
        sold_to_email: source.sold_to_email ?? params.buyerEmail,
        sold_to_name: source.sold_to_name ?? params.buyerName,
      })
      .eq('id', params.sourceArtworkId);
    if (artErr) logger.error('ensure_sale_artwork_link_failed', { artworkId: source.id, error: artErr });

    await refreshStatsQuietly([
      source.account_id as string,
      params.buyerAccountId,
      source.artist_account_id as string | null,
    ]);
    return { created: false, linked: true };
  }

  const res = await recordSale(admin, {
    artworkId: params.sourceArtworkId,
    buyer: { accountId: params.buyerAccountId, email: params.buyerEmail, name: params.buyerName },
    recordedBy: params.buyerAccountId,
    metadata: { source: 'coo_accept', invite_id: params.inviteId },
    syncMethod: 'ownership_accepted',
  });
  return { created: res.success, linked: false };
}

/**
 * When a Certificate of Ownership is sent, the sender is saying the work was
 * sold to that person. Make sure a sale exists for the source certificate with
 * the buyer on it, so the collector shows up before they accept. A sale
 * already recorded (e.g. by "Mark sold") is only filled in, never duplicated.
 */
export async function ensureSaleForSentOwnershipInvite(
  admin: SupabaseClient,
  params: {
    sourceArtworkId: string;
    buyerEmail: string;
    buyerName?: string | null;
    recordedBy: string;
  },
): Promise<{ created: boolean }> {
  const db = asUntyped(admin);
  const email = params.buyerEmail.trim().toLowerCase();
  const name = params.buyerName?.trim() || null;

  // Sending a CoO to yourself (a test, or your own copy) is not a sale.
  const { data: sender } = await db
    .from('accounts')
    .select('email')
    .eq('id', params.recordedBy)
    .maybeSingle();
  if ((sender?.email as string | null | undefined)?.trim().toLowerCase() === email) {
    return { created: false };
  }

  const { data: source } = await db
    .from('artworks')
    .select('id, is_sold, sold_at, sold_price_cents, sold_currency, sold_to_account_id, sold_to_email, sold_to_name')
    .eq('id', params.sourceArtworkId)
    .maybeSingle();
  if (!source) return { created: false };

  const { data: ledgerRows } = await db
    .from('sales_ledger')
    .select('id, sold_to_account_id, sold_to_email, sold_to_name')
    .eq('artwork_id', params.sourceArtworkId)
    .order('sold_at', { ascending: false })
    .limit(1);
  const latest = ledgerRows?.[0];

  if (latest) {
    if (!latest.sold_to_account_id && !latest.sold_to_email && !latest.sold_to_name) {
      await db
        .from('sales_ledger')
        .update({ sold_to_email: email, sold_to_name: name })
        .eq('id', latest.id);
      await db
        .from('artworks')
        .update({ sold_to_email: email, sold_to_name: source.sold_to_name ?? name })
        .eq('id', params.sourceArtworkId)
        .is('sold_to_email', null);
    }
    return { created: false };
  }

  const res = await recordSale(admin, {
    artworkId: params.sourceArtworkId,
    buyer: {
      accountId: source.sold_to_account_id as string | null,
      email: (source.sold_to_email as string | null) ?? email,
      name: (source.sold_to_name as string | null) ?? name,
    },
    priceCents: source.sold_price_cents as number | null,
    currency: source.sold_currency as string | null,
    soldAt: source.is_sold ? (source.sold_at as string | null) : null,
    recordedBy: params.recordedBy,
    metadata: { source: 'coo_sent' },
  });
  return { created: res.success };
}

async function refreshStatsQuietly(ids: Array<string | null | undefined>): Promise<void> {
  const unique = [...new Set(ids.filter((v): v is string => typeof v === 'string' && v.length > 0))];
  if (!unique.length) return;
  try {
    await refreshEntityStatsForAccounts(unique);
  } catch (err) {
    logger.error('record_sale_stats_refresh_failed', { error: err });
  }
}
