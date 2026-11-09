#!/usr/bin/env tsx
/**
 * Sending a Certificate of Ownership is a sale. CoOs sent before that rule have
 * no sale recorded; this records one per source certificate, dated when the
 * CoO was sent, with the buyer from the invite (and their account if they
 * accepted). Mirrors recordSale's writes: artworks sold columns, a
 * sales_ledger row, a 'sale' provenance event.
 *
 * Skips: cancelled invites, CoOs the sender sent to themself, and works that
 * already have a sale (is_sold, sold_at or a ledger row). Safe to re-run.
 *
 *   pnpm dotenv -e ./.env.local -- tsx scripts/backfill-coo-sales.ts --dry-run
 *   pnpm dotenv -e ./.env.local -- tsx scripts/backfill-coo-sales.ts
 */
import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Invite = {
  id: string;
  source_artwork_id: string;
  claim_kind: string;
  invitee_email: string;
  status: string;
  created_by: string;
  created_at: string;
  consumed_by: string | null;
};

async function main() {
  const { data: invites, error } = await db
    .from('certificate_claim_invites')
    .select('id, source_artwork_id, claim_kind, invitee_email, status, created_by, created_at, consumed_by')
    .like('claim_kind', 'owner%')
    .neq('status', 'cancelled')
    .order('created_at');
  if (error) throw error;

  const accountIds = [
    ...new Set((invites as Invite[]).flatMap((i) => [i.created_by, i.consumed_by]).filter(Boolean)),
  ] as string[];
  const { data: accounts } = await db.from('accounts').select('id, email, name').in('id', accountIds);
  const account = new Map((accounts ?? []).map((a) => [a.id as string, a]));

  // One sale per source certificate: the accepted invite if any, else the first one sent.
  const bySource = new Map<string, Invite[]>();
  for (const inv of invites as Invite[]) {
    const sender = account.get(inv.created_by);
    if (sender?.email && sender.email.trim().toLowerCase() === inv.invitee_email.trim().toLowerCase()) continue;
    bySource.set(inv.source_artwork_id, [...(bySource.get(inv.source_artwork_id) ?? []), inv]);
  }

  const sourceIds = [...bySource.keys()];
  const { data: artworks } = await db
    .from('artworks')
    .select('id, title, account_id, is_sold, sold_at')
    .in('id', sourceIds);
  const { data: ledger } = await db.from('sales_ledger').select('artwork_id').in('artwork_id', sourceIds);
  const hasLedger = new Set((ledger ?? []).map((r) => r.artwork_id as string));

  let done = 0;
  let skipped = 0;
  for (const art of artworks ?? []) {
    if (art.is_sold || art.sold_at || hasLedger.has(art.id)) {
      skipped++;
      continue;
    }
    const list = bySource.get(art.id)!;
    const inv = list.find((i) => i.status === 'consumed') ?? list[0]!;
    const buyerAccountId = inv.status === 'consumed' ? inv.consumed_by : null;
    const buyerName = buyerAccountId ? ((account.get(buyerAccountId)?.name as string | null) ?? null) : null;
    const buyerEmail = inv.invitee_email.trim().toLowerCase();
    const soldAt = inv.created_at;

    console.log(
      `${dryRun ? '[dry-run] ' : ''}${soldAt.slice(0, 10)} ${inv.status.padEnd(8)} ${art.title} (${art.id})`,
    );
    if (dryRun) {
      done++;
      continue;
    }

    const { error: upErr } = await db
      .from('artworks')
      .update({
        is_sold: true,
        sold_by_account_id: art.account_id,
        sold_to_account_id: buyerAccountId,
        sold_to_email: buyerEmail,
        sold_to_name: buyerName,
        sold_currency: 'USD',
        sold_at: soldAt,
      })
      .eq('id', art.id);
    if (upErr) {
      console.error('  artwork update failed', upErr.message);
      continue;
    }

    const metadata = { source: 'coo_sent_backfill', invite_id: inv.id };
    const { data: sale, error: saleErr } = await db
      .from('sales_ledger')
      .insert({
        artwork_id: art.id,
        sold_by_account_id: art.account_id,
        sold_to_account_id: buyerAccountId,
        sold_to_email: buyerEmail,
        sold_to_name: buyerName,
        price_cents: null,
        currency: 'USD',
        sold_at: soldAt,
        recorded_by: inv.created_by,
        metadata,
      })
      .select('id')
      .single();
    if (saleErr) console.error('  ledger insert failed', saleErr.message);

    const { error: evErr } = await db.from('provenance_events').insert({
      artwork_id: art.id,
      event_type: 'sale',
      actor_account_id: inv.created_by,
      event_date: soldAt,
      metadata: {
        ...metadata,
        sold_by_account_id: art.account_id,
        sold_to_account_id: buyerAccountId,
        sold_to_email: buyerEmail,
        sold_to_name: buyerName,
        price_cents: null,
        currency: 'USD',
        sale_id: sale?.id ?? null,
      },
    });
    if (evErr) console.error('  provenance event failed', evErr.message);
    done++;
  }

  console.log(`\n${dryRun ? 'Would record' : 'Recorded'} ${done} sale(s); ${skipped} already sold.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
