/**
 * Read-only investigation: Bryson Brooks sale to jasonrobertblake@gmail.com
 *
 * Usage: pnpm with-env npx tsx scripts/investigate-bryson-jrb-sale.ts
 *
 * Prints:
 *   1. Buyer account (auth.users, user_profiles, accounts) for jasonrobertblake@gmail.com
 *   2. All certificate_claim_invites for that email
 *   3. Source artwork(s) referenced by those invites
 *   4. Result artwork(s) if an invite was consumed
 *   5. sales_ledger rows for each source artwork
 *   6. Last 20 provenance_events for each source artwork
 *   7. Cross-check: Bryson Brooks + Flight gallery account lookup
 */

import { createClient } from '@supabase/supabase-js';

const BUYER_EMAIL = 'jasonrobertblake@gmail.com';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('[Investigate] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function hr(label: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${label}`);
  console.log('═'.repeat(60));
}

function section(label: string) {
  console.log('\n── ' + label + ' ──');
}

function pretty(obj: unknown) {
  console.log(JSON.stringify(obj, null, 2));
}

async function main() {
  console.log(`[Investigate] Bryson Brooks / JRB sale — ${new Date().toISOString()}`);
  console.log(`[Investigate] Buyer email: ${BUYER_EMAIL}`);

  // ── 1. Buyer in auth.users ──────────────────────────────────────────────
  hr('1. BUYER AUTH RECORD');
  const { data: authUsers, error: authErr } = await (admin as any)
    .from('auth.users')
    .select('id, email, created_at, confirmed_at, last_sign_in_at')
    .eq('email', BUYER_EMAIL);

  if (authErr) {
    // Supabase JS can't query auth.users directly with the anon/service REST endpoint,
    // use admin.auth.admin.listUsers and filter
    console.log('[Note] auth.users via table query not available, using admin.auth API');
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listErr) {
      console.error('[Error] auth.admin.listUsers failed:', listErr.message);
    } else {
      const buyer = listData?.users?.find(
        (u) => u.email?.toLowerCase() === BUYER_EMAIL.toLowerCase(),
      );
      if (buyer) {
        pretty({
          id: buyer.id,
          email: buyer.email,
          created_at: buyer.created_at,
          last_sign_in_at: buyer.last_sign_in_at,
          confirmed_at: buyer.confirmed_at,
          app_metadata: buyer.app_metadata,
        });
      } else {
        console.log('[Result] No auth user found for', BUYER_EMAIL);
      }
    }
  } else {
    pretty(authUsers);
  }

  // ── 2. accounts row ─────────────────────────────────────────────────────
  section('2a. accounts row for buyer email');
  const { data: accts, error: acctsErr } = await (admin as any)
    .from('accounts')
    .select('id, name, email, public_data, created_at')
    .eq('email', BUYER_EMAIL);
  if (acctsErr) console.error('[Error]', acctsErr.message);
  else pretty(accts);

  // ── 3. user_profiles ───────────────────────────────────────────────────
  section('2b. user_profiles for buyer email');
  const { data: uprofs, error: uprofsErr } = await (admin as any)
    .from('user_profiles')
    .select('id, user_id, email, name, role, is_active, created_at')
    .eq('email', BUYER_EMAIL);
  if (uprofsErr) console.error('[Error]', uprofsErr.message);
  else pretty(uprofs);

  // ── 4. certificate_claim_invites ────────────────────────────────────────
  hr('3. CERTIFICATE CLAIM INVITES for ' + BUYER_EMAIL);
  const { data: invites, error: invitesErr } = await (admin as any)
    .from('certificate_claim_invites')
    .select(
      'id, claim_kind, status, source_artwork_id, result_artwork_id, batch_id, created_at, consumed_at, expires_at, created_by, invitee_email',
    )
    .eq('invitee_email', BUYER_EMAIL)
    .order('created_at', { ascending: false });

  if (invitesErr) console.error('[Error]', invitesErr.message);
  else {
    console.log(`[Result] ${(invites ?? []).length} invite row(s) found`);
    pretty(invites);
  }

  const sourceArtworkIds = new Set<string>();
  const resultArtworkIds = new Set<string>();

  for (const inv of invites ?? []) {
    if (inv.source_artwork_id) sourceArtworkIds.add(inv.source_artwork_id);
    if (inv.result_artwork_id) resultArtworkIds.add(inv.result_artwork_id);
  }

  // ── 5. Source artworks ──────────────────────────────────────────────────
  hr('4. SOURCE ARTWORKS');
  for (const artId of sourceArtworkIds) {
    section(`Artwork ${artId}`);
    const { data: art, error: artErr } = await (admin as any)
      .from('artworks')
      .select(
        'id, title, artist_name, certificate_type, certificate_status, account_id, gallery_profile_id, ' +
          'sold_by, sold_by_account_id, sold_to_email, sold_to_account_id, sold_price_cents, sold_currency, ' +
          'sold_at, is_sold, source_artwork_id, created_at, updated_at',
      )
      .eq('id', artId)
      .single();

    if (artErr) { console.error('[Error]', artErr.message); continue; }
    pretty(art);

    // Owning account
    if (art?.account_id) {
      const { data: ownerAcct } = await (admin as any)
        .from('accounts')
        .select('id, name, email, public_data')
        .eq('id', art.account_id)
        .single();
      console.log('[Owner account]');
      pretty(ownerAcct);
    }

    // gallery_profile if set
    if (art?.gallery_profile_id) {
      const { data: gp } = await (admin as any)
        .from('user_profiles')
        .select('id, name, role')
        .eq('id', art.gallery_profile_id)
        .single();
      console.log('[Gallery profile]');
      pretty(gp);
    }
  }

  // ── 6. Result artworks (CoO created if invite consumed) ─────────────────
  hr('5. RESULT ARTWORKS (CoO if invite consumed)');
  for (const artId of resultArtworkIds) {
    section(`Result artwork ${artId}`);
    const { data: art, error: artErr } = await (admin as any)
      .from('artworks')
      .select(
        'id, title, artist_name, certificate_type, certificate_status, account_id, ' +
          'source_artwork_id, created_at, updated_at',
      )
      .eq('id', artId)
      .single();
    if (artErr) { console.error('[Error]', artErr.message); continue; }
    pretty(art);

    const { data: ownerAcct } = await (admin as any)
      .from('accounts')
      .select('id, name, email, public_data')
      .eq('id', art?.account_id)
      .single();
    console.log('[Owner account]');
    pretty(ownerAcct);
  }

  // ── 7. sales_ledger ─────────────────────────────────────────────────────
  hr('6. SALES_LEDGER ROWS');
  for (const artId of sourceArtworkIds) {
    section(`sales_ledger for artwork ${artId}`);
    const { data: sales, error: salesErr } = await (admin as any)
      .from('sales_ledger')
      .select('*')
      .eq('artwork_id', artId)
      .order('sold_at', { ascending: false });
    if (salesErr) console.error('[Error]', salesErr.message);
    else { console.log(`[Result] ${(sales ?? []).length} row(s)`); pretty(sales); }
  }

  // Also search sales_ledger by buyer email directly
  section('sales_ledger by sold_to_email');
  const { data: salesByEmail, error: sbeErr } = await (admin as any)
    .from('sales_ledger')
    .select('*')
    .eq('sold_to_email', BUYER_EMAIL)
    .order('sold_at', { ascending: false });
  if (sbeErr) console.error('[Error]', sbeErr.message);
  else { console.log(`[Result] ${(salesByEmail ?? []).length} row(s) by email`); pretty(salesByEmail); }

  // ── 8. provenance_events ─────────────────────────────────────────────────
  hr('7. PROVENANCE_EVENTS (last 20 per source artwork)');
  for (const artId of sourceArtworkIds) {
    section(`provenance_events for artwork ${artId}`);
    const { data: evts, error: evtsErr } = await (admin as any)
      .from('provenance_events')
      .select('*')
      .eq('artwork_id', artId)
      .order('event_date', { ascending: false })
      .limit(20);
    if (evtsErr) console.error('[Error]', evtsErr.message);
    else { console.log(`[Result] ${(evts ?? []).length} event(s)`); pretty(evts); }
  }

  // ── 9. Cross-check: Bryson Brooks + Flight gallery ───────────────────────
  hr('8. CROSS-CHECK: Bryson Brooks + Flight');
  section('accounts ILIKE %bryson%');
  const { data: brysonAccts } = await (admin as any)
    .from('accounts')
    .select('id, name, email, public_data')
    .ilike('name', '%bryson%');
  pretty(brysonAccts);

  section('user_profiles ILIKE %bryson%');
  const { data: brysonProfs } = await (admin as any)
    .from('user_profiles')
    .select('id, name, user_id, role')
    .ilike('name', '%bryson%');
  pretty(brysonProfs);

  section('accounts ILIKE %flight%');
  const { data: flightAccts } = await (admin as any)
    .from('accounts')
    .select('id, name, email, public_data')
    .ilike('name', '%flight%');
  pretty(flightAccts);

  section('user_profiles ILIKE %flight%');
  const { data: flightProfs } = await (admin as any)
    .from('user_profiles')
    .select('id, name, user_id, role')
    .ilike('name', '%flight%');
  pretty(flightProfs);

  // ── 10. If no invites found, search artworks with sold_to_email ──────────
  if ((invites ?? []).length === 0) {
    hr('9. FALLBACK: artworks WHERE sold_to_email = buyer email');
    const { data: soldArts, error: soldArtsErr } = await (admin as any)
      .from('artworks')
      .select(
        'id, title, artist_name, certificate_type, account_id, sold_by, sold_to_email, ' +
          'sold_price_cents, sold_currency, sold_at, is_sold, created_at',
      )
      .eq('sold_to_email', BUYER_EMAIL);
    if (soldArtsErr) console.error('[Error]', soldArtsErr.message);
    else { console.log(`[Result] ${(soldArts ?? []).length} artwork(s) sold to buyer`); pretty(soldArts); }

    // Also search by artist name
    section('artworks ILIKE artist_name %bryson%');
    const { data: brysonArts } = await (admin as any)
      .from('artworks')
      .select('id, title, artist_name, certificate_type, account_id, sold_to_email, sold_at, is_sold')
      .ilike('artist_name', '%bryson%');
    pretty(brysonArts);
  }

  hr('DONE');
  console.log('[Investigate] Script complete.\n');
}

main().catch((err) => {
  console.error('[Investigate] Fatal error:', err);
  process.exit(1);
});
