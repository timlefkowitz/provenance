#!/usr/bin/env tsx
/**
 * Sales data cleanup, 2026-11-09. Safe to re-run; every step checks first.
 *
 *  A. Undo the 6 sales scripts/backfill-sold-by-sales.ts recorded from the
 *     free-text "Sold by" field (wrong): ledger rows, sale events, sold
 *     columns, and the "Sold, <date>" provenance line added for them.
 *  B. Dawn over the Valley: one sale, price cleared ($1,000,000 was saved twice).
 *  C. Other same-day duplicate ledger rows: keep the priced (else oldest) row.
 *  D. Tag Fl!ght show works that have no gallery profile with FL!GHT.
 *  E. Outside Dogs: the 5 works emailed to collectors with "Send certificate"
 *     (a link only) are recorded as sales, unpriced, dated the send. No
 *     emails are sent; issuing the real Certificates of Ownership is separate.
 *
 *   pnpm dotenv -e ./.env.local -- tsx scripts/cleanup-sales-2026-11.ts --dry-run
 *   pnpm dotenv -e ./.env.local -- tsx scripts/cleanup-sales-2026-11.ts
 *
 * Writes a JSON audit of every row it changes to --audit <dir> (default /tmp).
 */
import { writeFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');
const auditDir = process.argv[process.argv.indexOf('--audit') + 1] ?? '/tmp';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const FLIGHT_ACCOUNT = '28f3c8e1-2d0f-4b3d-8902-77f9453a83f1';
const FLIGHT_PROFILE = '327a8dd9-a8ad-4c0b-a58f-a15cfa530c76';
const DAWN = 'b2c8948c-b7a5-48cb-8f81-36a418b30c64';
const OUTSIDE_DOGS = '50f72823-35d5-4460-829b-0b8687937b58';

const audit: Array<{ step: string; table: string; id: string; action: string; before?: unknown; after?: unknown }> = [];
const tag = dryRun ? '[dry-run] ' : '';

type Ledger = {
  id: string;
  artwork_id: string;
  sold_at: string;
  price_cents: number | null;
  sold_to_account_id: string | null;
  sold_to_email: string | null;
  sold_to_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

/** Every certificate linked to `id` (root and descendants). */
async function chainOf(id: string): Promise<string[]> {
  let root = id;
  for (let i = 0; i < 64; i++) {
    const row = await must<{ source_artwork_id: string | null } | null>(
      db.from('artworks').select('source_artwork_id').eq('id', root).maybeSingle(),
    );
    if (!row?.source_artwork_id) break;
    root = row.source_artwork_id;
  }
  const ids = new Set([root]);
  for (let frontier = [root], i = 0; frontier.length && i < 64; i++) {
    const kids = await must<Array<{ id: string }>>(db.from('artworks').select('id').in('source_artwork_id', frontier));
    frontier = kids.map((k) => k.id).filter((k) => !ids.has(k));
    frontier.forEach((k) => ids.add(k));
  }
  return [...ids];
}

async function deleteRows(step: string, table: string, rows: Array<{ id: string }>) {
  for (const r of rows) {
    audit.push({ step, table, id: r.id, action: 'delete', before: r });
    if (!dryRun) await must(db.from(table).delete().eq('id', r.id));
  }
}

async function updateRow(step: string, table: string, id: string, before: unknown, after: Record<string, unknown>) {
  audit.push({ step, table, id, action: 'update', before, after });
  if (!dryRun) await must(db.from(table).update(after).eq('id', id));
}

const SOLD_CLEAR = {
  is_sold: false,
  sold_at: null,
  sold_by_account_id: null,
  sold_to_account_id: null,
  sold_to_email: null,
  sold_to_name: null,
  sold_price_cents: null,
};

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

async function flightTotals(label: string) {
  const rows = await must<Array<{ price_cents: number | null }>>(
    db.from('sales_ledger').select('price_cents').eq('sold_by_account_id', FLIGHT_ACCOUNT),
  );
  const cents = rows.reduce((a, r) => a + (r.price_cents ?? 0), 0);
  console.log(`${label}: Fl!ght ledger rows ${rows.length}, priced total $${(cents / 100).toLocaleString('en-US')}`);
}

// ------------------------------------------------------------------------- A
async function undoSoldByBackfill() {
  const rows = await must<Ledger[]>(db.from('sales_ledger').select('*').eq('metadata->>source', 'sold_by_backfill'));
  console.log(`\nA. ${tag}undo ${rows.length} "Sold by" backfill sale(s)`);
  const events = await must<Array<{ id: string; artwork_id: string }>>(
    db.from('provenance_events').select('id, artwork_id, event_type, metadata').eq('event_type', 'sale').eq('metadata->>source', 'sold_by_backfill'),
  );
  await deleteRows('A', 'provenance_events', events);
  await deleteRows('A', 'sales_ledger', rows);

  for (const sale of rows) {
    const ids = await chainOf(sale.artwork_id);
    const remaining = await must<Array<{ id: string }>>(
      db.from('sales_ledger').select('id').in('artwork_id', ids).neq('metadata->>source', 'sold_by_backfill'),
    );
    const certs = await must<Array<Record<string, unknown> & { id: string; title: string }>>(
      db
        .from('artworks')
        .select('id, title, is_sold, sold_at, sold_by_account_id, sold_to_account_id, sold_to_email, sold_to_name, sold_price_cents, auction_history, provenance_history')
        .in('id', ids),
    );
    const line = `Sold, ${longDate(sale.sold_at)}`;
    for (const c of certs) {
      const after: Record<string, unknown> = {};
      if (!remaining.length && (c.is_sold || c.sold_at)) Object.assign(after, SOLD_CLEAR);
      const history = (c.auction_history as string | null) ?? '';
      const lines = history.split('\n');
      if (lines.some((l) => l.trim() === line)) {
        const kept = lines.filter((l) => l.trim() !== line).join('\n').trim();
        after.auction_history = kept || null;
        const ph = Array.isArray(c.provenance_history) ? (c.provenance_history as Array<Record<string, unknown>>) : [];
        const idx = ph.findLastIndex(
          (e) =>
            (e.via as Record<string, unknown> | undefined)?.method === 'backfill' &&
            'auction_history' in ((e.previousValues as Record<string, unknown>) ?? {}),
        );
        if (idx >= 0) after.provenance_history = ph.filter((_, i) => i !== idx);
      }
      if (!Object.keys(after).length) continue;
      console.log(`  ${tag}${c.title} (${c.id}): ${Object.keys(after).join(', ')}`);
      await updateRow('A', 'artworks', c.id, Object.fromEntries(Object.keys(after).map((k) => [k, c[k]])), after);
    }
  }
}

// ---------------------------------------------------------------------- B, C
async function dedupeLedger() {
  const rows = await must<Ledger[]>(db.from('sales_ledger').select('*').order('created_at'));
  const groups = new Map<string, Ledger[]>();
  for (const r of rows) {
    const key = `${r.artwork_id}|${r.sold_at.slice(0, 10)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const dupes = [...groups.values()].filter((g) => g.length > 1);
  console.log(`\nB/C. ${tag}${dupes.length} work(s) with the same sale saved more than once`);

  for (const group of dupes) {
    const isDawn = group[0]!.artwork_id === DAWN;
    const keep = isDawn ? group[0]! : (group.find((r) => (r.price_cents ?? 0) > 0) ?? group[0]!);
    const drop = group.filter((r) => r.id !== keep.id);
    const fill: Record<string, unknown> = {};
    for (const r of drop) {
      for (const k of ['sold_to_account_id', 'sold_to_email', 'sold_to_name'] as const) {
        if (!keep[k] && r[k] && !fill[k]) fill[k] = r[k];
      }
    }
    if (isDawn && keep.price_cents != null) fill.price_cents = null;
    console.log(`  ${tag}${keep.artwork_id} ${keep.sold_at.slice(0, 10)}: keep 1, remove ${drop.length}${isDawn ? ', clear price' : ''}`);

    // Each removed row's sale event is a duplicate too.
    for (const r of drop) {
      const ev = await must<Array<{ id: string }>>(
        db.from('provenance_events').select('id, artwork_id, metadata').eq('event_type', 'sale').eq('metadata->>sale_id', r.id),
      );
      await deleteRows('C', 'provenance_events', ev);
    }
    await deleteRows('C', 'sales_ledger', drop);
    if (Object.keys(fill).length) await updateRow('C', 'sales_ledger', keep.id, keep, fill);
  }

  // Dawn's price on its certificates.
  const dawnChain = await chainOf(DAWN);
  const priced = await must<Array<{ id: string; sold_price_cents: number | null }>>(
    db.from('artworks').select('id, sold_price_cents').in('id', dawnChain).not('sold_price_cents', 'is', null),
  );
  for (const p of priced) {
    console.log(`  ${tag}Dawn over the Valley certificate ${p.id}: clear sold price`);
    await updateRow('B', 'artworks', p.id, p, { sold_price_cents: null });
  }
}

// ------------------------------------------------------------------------- D
async function tagFlightProfile() {
  const shows = await must<Array<{ id: string }>>(db.from('exhibitions').select('id').eq('gallery_id', FLIGHT_ACCOUNT));
  const links = await must<Array<{ artwork_id: string }>>(
    db.from('exhibition_artworks').select('artwork_id').in('exhibition_id', shows.map((s) => s.id)),
  );
  const ids = [...new Set(links.map((l) => l.artwork_id))];
  let tagged = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const rows = await must<Array<{ id: string }>>(
      db.from('artworks').select('id').in('id', ids.slice(i, i + 200)).eq('account_id', FLIGHT_ACCOUNT).is('gallery_profile_id', null),
    );
    for (const r of rows) {
      audit.push({ step: 'D', table: 'artworks', id: r.id, action: 'update', before: { gallery_profile_id: null }, after: { gallery_profile_id: FLIGHT_PROFILE } });
    }
    if (!dryRun && rows.length) {
      await must(db.from('artworks').update({ gallery_profile_id: FLIGHT_PROFILE }).in('id', rows.map((r) => r.id)));
    }
    tagged += rows.length;
  }
  console.log(`\nD. ${tag}tag ${tagged} Fl!ght show work(s) with the FL!GHT gallery profile`);
}

// ------------------------------------------------------------------------- E
async function recordOutsideDogsSends() {
  const links = await must<Array<{ artwork_id: string }>>(
    db.from('exhibition_artworks').select('artwork_id').eq('exhibition_id', OUTSIDE_DOGS),
  );
  const showIds = links.map((l) => l.artwork_id);
  const leadLinks = await must<Array<{ lead_id: string; artwork_id: string; created_at: string }>>(
    db.from('artist_lead_artworks').select('lead_id, artwork_id, created_at').in('artwork_id', showIds),
  );
  const leads = await must<Array<{ id: string; contact_name: string | null; contact_email: string | null; notes: string | null }>>(
    db.from('artist_leads').select('id, contact_name, contact_email, notes').in('id', [...new Set(leadLinks.map((l) => l.lead_id))]),
  );
  const titles = new Map(
    (await must<Array<{ id: string; title: string }>>(db.from('artworks').select('id, title').in('id', showIds))).map((a) => [
      a.id,
      a.title,
    ]),
  );
  // The lead's notes name each work sent with "Send certificate" to a collector.
  const sends = leadLinks
    .map((l) => ({ ...l, lead: leads.find((x) => x.id === l.lead_id) }))
    .filter((s) => (s.lead?.notes ?? '').includes(`Certificate sent to collector — ${titles.get(s.artwork_id)}`));
  console.log(`\nE. ${tag}${sends.length} Outside Dogs work(s) sent to a collector as a link only`);

  for (const s of sends) {
    const art = await must<{ id: string; title: string; account_id: string; is_sold: boolean; auction_history: string | null }>(
      db.from('artworks').select('id, title, account_id, is_sold, auction_history').eq('id', s.artwork_id).single(),
    );
    const chain = await chainOf(art.id);
    const existing = await must<Array<{ id: string }>>(db.from('sales_ledger').select('id').in('artwork_id', chain));
    if (art.is_sold || existing.length) {
      console.log(`  skip ${art.title}: already sold`);
      continue;
    }
    const soldAt = s.created_at;
    const buyerEmail = s.lead!.contact_email?.trim().toLowerCase() || null;
    const buyerName = s.lead!.contact_name?.trim() || null;
    console.log(`  ${tag}${soldAt.slice(0, 10)} ${art.title} → ${buyerName ?? ''} <${buyerEmail ?? '?'}>`);
    audit.push({ step: 'E', table: 'sales_ledger', id: art.id, action: 'insert', after: { soldAt, buyerEmail, buyerName } });
    if (dryRun) continue;

    const metadata = { source: 'outside_dogs_link_send', lead_id: s.lead_id, exhibition_id: OUTSIDE_DOGS };
    await must(
      db
        .from('artworks')
        .update({
          is_sold: true,
          sold_at: soldAt,
          sold_by_account_id: art.account_id,
          sold_to_email: buyerEmail,
          sold_to_name: buyerName,
          sold_currency: 'USD',
          auction_history: [art.auction_history?.trim(), `Sold, ${longDate(soldAt)}`].filter(Boolean).join('\n'),
        })
        .eq('id', art.id),
    );
    const sale = await must<{ id: string }>(
      db
        .from('sales_ledger')
        .insert({
          artwork_id: art.id,
          sold_by_account_id: art.account_id,
          sold_to_email: buyerEmail,
          sold_to_name: buyerName,
          price_cents: null,
          currency: 'USD',
          sold_at: soldAt,
          recorded_by: null,
          notes: 'Recorded from a "Send certificate" email to the collector',
          metadata,
        })
        .select('id')
        .single(),
    );
    await must(
      db.from('provenance_events').insert({
        artwork_id: art.id,
        event_type: 'sale',
        actor_account_id: null,
        event_date: soldAt,
        metadata: { ...metadata, sold_by_account_id: art.account_id, sold_to_email: buyerEmail, sold_to_name: buyerName, sale_id: sale.id },
      }),
    );
  }
}

async function main() {
  await flightTotals('Before');
  await undoSoldByBackfill();
  await dedupeLedger();
  await tagFlightProfile();
  await recordOutsideDogsSends();
  if (!dryRun) await flightTotals('\nAfter');

  const file = `${auditDir}/sales-cleanup-${dryRun ? 'dry-run-' : ''}${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(audit, null, 2));
  console.log(`\n${dryRun ? 'Would change' : 'Changed'} ${audit.length} row(s). Audit: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
