import { asUntyped } from '~/lib/supabase-untyped';
import type { SupabaseClient } from '@supabase/supabase-js';

import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';
import { logger } from '~/lib/logger';
import { createNotification } from '~/lib/notifications';
import { findRootId, getChainArtworkIds } from '~/lib/provenance/chain';
import { countChainSales } from '~/lib/sales/count-chain-sales';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import {
  computeProvenanceValue,
  EXHIBITION_PREMIUM,
  formatProvenanceAmount,
  type ProvenanceValue,
  SALE_PREMIUM,
  sanitizePublications,
} from '~/lib/valuation/provenance-value';

/**
 * Keeps artists in the loop on their work after it leaves the studio: a sale
 * or Certificate of Ownership, a show, or any other change to its provenance.
 * Every function here is best-effort and never throws.
 */

type ArtistWork = {
  artistId: string | null;
  /** The artist's own certificate (the chain root), used for title and price. */
  coaId: string;
  title: string;
};

type ArtworkRow = {
  id: string;
  title: string | null;
  account_id: string | null;
  artist_account_id: string | null;
  certificate_type: string | null;
};

/**
 * The artist's account for a work, from any of its certificates: the row's
 * artist_account_id, else the chain root's, else the holder of the root CoA.
 */
export async function resolveArtistOfWork(
  admin: SupabaseClient,
  artworkId: string,
): Promise<ArtistWork | null> {
  const db = asUntyped(admin);
  try {
    const rootId = await findRootId(admin, artworkId);
    const { data } = await db
      .from('artworks')
      .select('id, title, account_id, artist_account_id, certificate_type')
      .in('id', [...new Set([artworkId, rootId])]);
    const rows = (data ?? []) as ArtworkRow[];
    const row = rows.find((r) => r.id === artworkId);
    const root = rows.find((r) => r.id === rootId) ?? row;
    if (!row || !root) return null;
    const artistId =
      row.artist_account_id ??
      root.artist_account_id ??
      (root.certificate_type === CERTIFICATE_TYPES.AUTHENTICITY ? root.account_id : null);
    return {
      artistId,
      coaId: root.id,
      title: root.title || row.title || 'Your artwork',
    };
  } catch (err) {
    logger.error('resolve_artist_of_work_failed', { artworkId, error: err });
    return null;
  }
}

/**
 * Provenance Value of a work as its certificate shows it: the artist's price
 * on the root certificate plus premiums for shows, publications and sales
 * across every linked certificate. Null when there's no usable price.
 */
export async function loadWorkProvenanceValue(
  admin: SupabaseClient,
  artworkId: string,
): Promise<{ value: ProvenanceValue | null; exhibitionCount: number; saleCount: number }> {
  const db = asUntyped(admin);
  try {
    const { rootId, ids } = await getChainArtworkIds(admin, artworkId);
    const [rootRes, soldRes, showsRes, saleCount] = await Promise.all([
      db.from('artworks').select('value, publications').eq('id', rootId).maybeSingle(),
      db
        .from('artworks')
        .select('sold_price_cents, sold_currency')
        .in('id', ids)
        .or('is_sold.eq.true,sold_at.not.is.null')
        .limit(1),
      db.from('exhibition_artworks').select('exhibition_id, status').in('artwork_id', ids),
      countChainSales(admin, artworkId),
    ]);
    const shows = new Set(
      ((showsRes.data ?? []) as Array<{ exhibition_id: string; status: string | null }>)
        .filter((r) => isShownInExhibition(r.status))
        .map((r) => r.exhibition_id),
    );
    const sold = (soldRes.data ?? [])[0] as
      | { sold_price_cents: number | null; sold_currency: string | null }
      | undefined;
    const value = computeProvenanceValue({
      value: (rootRes.data?.value as string | null) ?? null,
      exhibitionCount: shows.size,
      publicationCount: sanitizePublications(rootRes.data?.publications).length,
      sale: sold ? { priceCents: sold.sold_price_cents, currency: sold.sold_currency } : null,
      saleCount,
    });
    return { value, exhibitionCount: shows.size, saleCount };
  } catch (err) {
    logger.error('load_work_provenance_value_failed', { artworkId, error: err });
    return { value: null, exhibitionCount: 0, saleCount: 0 };
  }
}

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

/** "Its Provenance Value is up 5% — now $4,725." Pure; exported for tests. */
export function describeValueIncrease(value: ProvenanceValue | null, rate: number, reason: string): string {
  if (!value) {
    return `${reason} adds ${pct(rate)} to its Provenance Value. Add a price to the certificate to see the figure.`;
  }
  return `${reason} adds ${pct(rate)} to its Provenance Value — now ${formatProvenanceAmount(value.total, value.currency)}.`;
}

/**
 * Tell the artist their work sold. When the sale came with a Certificate of
 * Ownership (a buyer to send it to), say so. Either way, say what the sale did
 * to the work's Provenance Value. Skips the artist recording their own sale.
 */
export async function notifyArtistOfSale(
  admin: SupabaseClient,
  params: {
    artworkId: string;
    saleId: string | null;
    recordedBy: string | null;
    source: string;
    hasBuyer: boolean;
    exhibitionId?: string | null;
  },
): Promise<void> {
  try {
    const work = await resolveArtistOfWork(admin, params.artworkId);
    if (!work?.artistId || work.artistId === params.recordedBy) return;

    let exhibitionTitle: string | null = null;
    if (params.exhibitionId) {
      const { data } = await asUntyped(admin)
        .from('exhibitions')
        .select('title')
        .eq('id', params.exhibitionId)
        .maybeSingle();
      exhibitionTitle = (data?.title as string | null) ?? null;
    }

    const { value } = await loadWorkProvenanceValue(admin, params.artworkId);
    const sentCoo = params.source === 'coo_sent' || params.source === 'coo_accept' || params.hasBuyer;

    const lead = exhibitionTitle
      ? `"${work.title}" sold through the exhibition "${exhibitionTitle}".`
      : sentCoo
        ? `"${work.title}" sold to a collector.`
        : `"${work.title}" was marked sold.`;
    const coo = sentCoo ? ' The buyer was sent a Certificate of Ownership.' : '';
    const valueLine = describeValueIncrease(value, SALE_PREMIUM, 'The sale');

    await createNotification({
      userId: work.artistId,
      type: exhibitionTitle ? 'exhibition_artwork_sold' : 'artist_artwork_sold',
      title: exhibitionTitle
        ? `Sold at "${exhibitionTitle}"`
        : sentCoo
          ? `Certificate of Ownership sent for "${work.title}"`
          : `"${work.title}" sold`,
      message: `${lead}${coo} ${valueLine}`,
      artworkId: work.coaId,
      relatedUserId: params.recordedBy ?? undefined,
      metadata: {
        sale_id: params.saleId,
        source: params.source,
        exhibition_id: params.exhibitionId ?? null,
        sold_artwork_id: params.artworkId,
        provenance_value: value?.total ?? null,
      },
    });
  } catch (err) {
    logger.error('notify_artist_of_sale_failed', { artworkId: params.artworkId, error: err });
  }
}

/**
 * Tell artists when their work is shown in a published exhibition, with what
 * that did to its Provenance Value. One notification per artist per show.
 * Skips the organiser and the person acting.
 */
export async function notifyArtistsOfExhibition(
  admin: SupabaseClient,
  params: {
    exhibition: { id: string; title: string; gallery_id: string | null };
    artworkIds: string[];
    actorUserId?: string | null;
  },
): Promise<void> {
  try {
    const db = asUntyped(admin);
    const skip = new Set([params.exhibition.gallery_id, params.actorUserId].filter(Boolean));
    const worksByArtist = new Map<string, { artworkId: string; coaId: string; title: string }[]>();
    for (const artworkId of params.artworkIds) {
      const work = await resolveArtistOfWork(admin, artworkId);
      if (!work?.artistId || skip.has(work.artistId)) continue;
      const list = worksByArtist.get(work.artistId) ?? [];
      if (!list.some((w) => w.coaId === work.coaId)) list.push({ artworkId, coaId: work.coaId, title: work.title });
      worksByArtist.set(work.artistId, list);
    }
    if (!worksByArtist.size) return;

    const { data: existing } = await db
      .from('notifications')
      .select('user_id')
      .eq('type', 'artist_artwork_exhibited')
      .in('user_id', Array.from(worksByArtist.keys()))
      .contains('metadata', { exhibition_id: params.exhibition.id });
    const alreadyNotified = new Set(((existing ?? []) as Array<{ user_id: string }>).map((n) => n.user_id));

    for (const [artistId, works] of worksByArtist) {
      if (alreadyNotified.has(artistId)) continue;
      const first = works[0]!;
      const showTitle = params.exhibition.title;
      let message: string;
      if (works.length === 1) {
        const { value, exhibitionCount } = await loadWorkProvenanceValue(admin, first.artworkId);
        // Only a work's first show adds the exhibition premium.
        const valueLine =
          exhibitionCount <= 1
            ? describeValueIncrease(value, EXHIBITION_PREMIUM, 'Its first exhibition')
            : value
              ? `It has now been in ${exhibitionCount} exhibitions; its Provenance Value is ${formatProvenanceAmount(value.total, value.currency)}.`
              : `It has now been in ${exhibitionCount} exhibitions.`;
        message = `"${first.title}" is on view in "${showTitle}" and has been added to its exhibition history. ${valueLine}`;
      } else {
        message = `${works.length} of your works are on view in "${showTitle}" and have been added to their exhibition history. A work's first exhibition adds ${pct(EXHIBITION_PREMIUM)} to its Provenance Value.`;
      }
      try {
        await createNotification({
          userId: artistId,
          type: 'artist_artwork_exhibited',
          title: `On view in "${showTitle}"`,
          message,
          artworkId: first.coaId,
          relatedUserId: params.exhibition.gallery_id ?? undefined,
          metadata: {
            exhibition_id: params.exhibition.id,
            artwork_ids: works.map((w) => w.coaId),
          },
        });
      } catch (err) {
        logger.error('notify_artist_of_exhibition_failed', { artistId, error: err });
      }
    }
  } catch (err) {
    logger.error('notify_artists_of_exhibition_failed', { exhibitionId: params.exhibition.id, error: err });
  }
}
