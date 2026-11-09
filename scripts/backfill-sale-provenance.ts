#!/usr/bin/env tsx
/**
 * Every recorded sale should show in the work's provenance on all of its
 * certificates (CoA, CoS, CoO). Sales recorded before recordSale wrote the
 * provenance line have none. For each work with a sale this:
 *
 *  - adds "Sold, <date>" to Auction History on every linked certificate that
 *    doesn't already have a "Sold…" line for that day (one line per distinct
 *    sale day; same-day ledger duplicates are one sale);
 *  - sets "Owned by" to the buyer's name on certificates where it is blank,
 *    when the sale has a buyer name (emails and usernames are never written).
 *
 * Names and prices stay out of the sale line. Each change is tagged in
 * provenance_history (method "backfill"). Safe to re-run.
 *
 *   pnpm dotenv -e ./.env.local -- tsx scripts/backfill-sale-provenance.ts --dry-run
 *   pnpm dotenv -e ./.env.local -- tsx scripts/backfill-sale-provenance.ts
 */
import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Art = {
  id: string;
  title: string | null;
  certificate_type: string | null;
  source_artwork_id: string | null;
  is_sold: boolean | null;
  sold_at: string | null;
  sold_to_name: string | null;
  owned_by: string | null;
  auction_history: string | null;
  provenance_history: unknown;
};
type Sale = { artwork_id: string; sold_at: string | null; sold_to_name: string | null };

const ART_COLS =
  'id, title, certificate_type, source_artwork_id, is_sold, sold_at, sold_to_name, owned_by, auction_history, provenance_history';

function formatSaleDate(soldAt: string): string {
  return new Date(soldAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function hasSaleLine(history: string | null, soldAt: string): boolean {
  const long = formatSaleDate(soldAt).toLowerCase();
  const iso = soldAt.slice(0, 10);
  return (history ?? '')
    .split('\n')
    .map((l) => l.trim().toLowerCase())
    .some((l) => l.startsWith('sold') && (l.includes(long) || l.includes(iso)));
}

// A person's name, not an email or a username like "ddowers9927".
const realName = (n: string | null | undefined) =>
  n && n.trim() && !n.includes('@') && !/\d/.test(n) ? n.trim() : null;

async function fetchAll<T>(table: string, cols: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(cols).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

async function main() {
  const sales = await fetchAll<Sale>('sales_ledger', 'artwork_id, sold_at, sold_to_name');
  const soldArts = await fetchAll<Art>('artworks', ART_COLS, (q) => q.or('is_sold.eq.true,sold_at.not.is.null'));

  // Load every certificate linked to a sold work: walk up to the root, then down.
  const arts = new Map<string, Art>(soldArts.map((a) => [a.id, a]));
  const load = async (ids: string[]) => {
    const missing = ids.filter((id) => !arts.has(id));
    for (let i = 0; i < missing.length; i += 200) {
      const rows = await fetchAll<Art>('artworks', ART_COLS, (q) => q.in('id', missing.slice(i, i + 200)));
      rows.forEach((r) => arts.set(r.id, r));
    }
  };
  await load([...new Set(sales.map((s) => s.artwork_id))]);
  for (let i = 0; i < 64; i++) {
    const parents = [...arts.values()].map((a) => a.source_artwork_id).filter((id): id is string => !!id && !arts.has(id));
    if (!parents.length) break;
    await load(parents);
  }
  for (let frontier = [...arts.keys()], i = 0; frontier.length && i < 64; i++) {
    const next: string[] = [];
    for (let j = 0; j < frontier.length; j += 200) {
      const kids = await fetchAll<Art>('artworks', ART_COLS, (q) => q.in('source_artwork_id', frontier.slice(j, j + 200)));
      for (const k of kids) if (!arts.has(k.id)) { arts.set(k.id, k); next.push(k.id); }
    }
    frontier = next;
  }

  const rootOf = (id: string): string => {
    let cur = id;
    for (let i = 0; i < 64; i++) {
      const p = arts.get(cur)?.source_artwork_id;
      if (!p || !arts.has(p)) return cur;
      cur = p;
    }
    return cur;
  };
  const chains = new Map<string, Art[]>();
  for (const a of arts.values()) chains.set(rootOf(a.id), [...(chains.get(rootOf(a.id)) ?? []), a]);

  let linesAdded = 0;
  let ownersSet = 0;
  let worksTouched = 0;
  const ownerConflicts: string[] = [];

  for (const chain of chains.values()) {
    const ids = new Set(chain.map((a) => a.id));
    const chainSales = sales.filter((s) => ids.has(s.artwork_id));
    // One sale per day; certificates marked sold with no ledger row that day count too.
    const byDay = new Map<string, { soldAt: string; name: string | null }>();
    for (const s of chainSales) {
      if (!s.sold_at) continue;
      const day = s.sold_at.slice(0, 10);
      const prev = byDay.get(day);
      byDay.set(day, { soldAt: prev?.soldAt ?? s.sold_at, name: prev?.name ?? realName(s.sold_to_name) });
    }
    for (const a of chain) {
      if (!(a.is_sold || a.sold_at) || !a.sold_at) continue;
      const day = a.sold_at.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { soldAt: a.sold_at, name: realName(a.sold_to_name) });
    }
    if (!byDay.size) continue;

    const days = [...byDay.values()].sort((x, y) => x.soldAt.localeCompare(y.soldAt));
    const latestBuyer = [...days].reverse().find((d) => d.name)?.name ?? null;
    const label = chain.find((a) => a.source_artwork_id === null)?.title ?? chain[0]!.title;

    for (const a of chain) {
      let history = a.auction_history?.trim() || null;
      const added: string[] = [];
      for (const d of days) {
        if (hasSaleLine(history, d.soldAt)) continue;
        const line = `Sold, ${formatSaleDate(d.soldAt)}`;
        history = history ? `${history}\n${line}` : line;
        added.push(line);
      }
      const update: Record<string, unknown> = {};
      const previousValues: Record<string, unknown> = {};
      if (added.length) {
        update.auction_history = history;
        previousValues.auction_history = a.auction_history;
      }
      if (latestBuyer && !a.owned_by?.trim()) {
        update.owned_by = latestBuyer;
        previousValues.owned_by = a.owned_by;
      } else if (latestBuyer && !a.owned_by!.toLowerCase().includes(latestBuyer.toLowerCase())) {
        ownerConflicts.push(`${label} (${a.certificate_type}, ${a.id}): owned_by "${a.owned_by}" vs buyer "${latestBuyer}"`);
      }
      if (!Object.keys(update).length) continue;

      worksTouched++;
      linesAdded += added.length;
      if (update.owned_by) ownersSet++;
      console.log(
        `${dryRun ? '[dry-run] ' : ''}${label} · ${a.certificate_type ?? '?'} ${a.id}` +
          (added.length ? `  + ${added.join(' / ')}` : '') +
          (update.owned_by ? `  owner → ${update.owned_by}` : ''),
      );
      if (dryRun) continue;

      const prior = Array.isArray(a.provenance_history) ? a.provenance_history : [];
      update.provenance_history = [
        ...prior,
        {
          editedAt: new Date().toISOString(),
          editedBy: null,
          previousValues,
          via: { certificate_type: a.certificate_type, artwork_id: a.id, method: 'backfill', actor_name: null },
        },
      ].slice(-200);
      const { error } = await db.from('artworks').update(update).eq('id', a.id);
      if (error) console.error('  update failed', error.message);
    }
  }

  console.log(
    `\n${dryRun ? 'Would update' : 'Updated'} ${worksTouched} certificate(s): ${linesAdded} sale line(s), ${ownersSet} owner(s).`,
  );
  if (ownerConflicts.length) {
    console.log(`\nLeft alone — owner differs from the latest buyer (${ownerConflicts.length}):`);
    ownerConflicts.forEach((c) => console.log('  ' + c));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
