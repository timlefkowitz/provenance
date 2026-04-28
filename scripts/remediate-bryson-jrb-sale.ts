/**
 * One-off remediation: Bryson Brooks sale at Fl!ght to Jason Blake (jasonrobertblake@gmail.com)
 *
 * What happened (from investigation 2026-04-27):
 *   - The gallery sent claim_kind="artist_coa_from_show" to jasonrobertblake@gmail.com
 *     (a collector). This was WRONG — Jason should have received a CoO invite, and
 *     Bryson Brooks (brysonbrooks2025@gmail.com) should have received the artist invite.
 *   - The artwork is still NOT marked as sold (is_sold=false, sold_at=null, etc.)
 *   - No sales_ledger row or provenance_event exists for the sale
 *
 * This script (with dry-run=true by default):
 *   1. Cancels the wrong invite to jasonrobertblake@gmail.com
 *   2. Marks the artwork as sold to Jason Blake at Fl!ght, April 23 2026
 *   3. Inserts a sales_ledger row
 *   4. Inserts a provenance_event of type "sale"
 *   5. Backfills auction_history with a human-readable sale line
 *   6. Sends the CORRECT artist_coa_from_show invite to brysonbrooks2025@gmail.com
 *      (so Bryson can claim his CoA; a CoO for Jason can be sent from that CoA after)
 *
 * Note: Jason Blake's Certificate of Ownership invite CANNOT be sent yet because
 * a CoO must descend from a Certificate of Authenticity (not from a CoS directly).
 * Once Bryson accepts his CoA, the gallery can invite Jason for his CoO from the
 * "Send to Collector" button on Bryson's CoA page, or it will be sent automatically
 * after the artwork is marked sold once Bryson's CoA exists.
 *
 * Usage:
 *   # Dry run (default — prints what WOULD be done, writes nothing):
 *   npx dotenv-cli -e .env.production.local -- npx tsx scripts/remediate-bryson-jrb-sale.ts
 *
 *   # Live run (actually writes):
 *   DRY_RUN=false npx dotenv-cli -e .env.production.local -- npx tsx scripts/remediate-bryson-jrb-sale.ts
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

const DRY_RUN = process.env.DRY_RUN !== 'false';

// Known IDs from investigation
const ARTWORK_ID = 'be305c8b-3847-4517-8837-c29a5adcdc9b';
const WRONG_INVITE_ID = '86002eb0-e94e-4d81-a53d-fcd99bc2a3ce';
const GALLERY_ACCOUNT_ID = '28f3c8e1-2d0f-4b3d-8902-77f9453a83f1'; // Timothy / Fl!ght
const GALLERY_PROFILE_ID = '327a8dd9-a8ad-4c0b-a58f-a15cfa530c76'; // Fl!ght
const GALLERY_NAME = 'Fl!ght';
const BUYER_EMAIL = 'jasonrobertblake@gmail.com';
const BUYER_ACCOUNT_ID = '479a6836-654e-4989-834c-fd98dba5d0e9';
const BUYER_NAME = 'Jason Blake';
const ARTIST_EMAIL = 'brysonbrooks2025@gmail.com';
const ARTIST_ACCOUNT_ID = '64361494-ff28-4730-abe0-ddd6587c7b2f';
const SALE_DATE = '2026-04-23T20:00:00.000Z'; // approximate evening time
const SALE_DATE_DISPLAY = 'April 23, 2026';
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('[Remediate] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function log(msg: string, obj?: unknown) {
  const prefix = DRY_RUN ? '[DRY RUN]' : '[LIVE]';
  if (obj !== undefined) {
    console.log(`${prefix} ${msg}`, JSON.stringify(obj, null, 2));
  } else {
    console.log(`${prefix} ${msg}`);
  }
}

function generateToken(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Bryson Brooks / JRB Sale Remediation');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE — writes will happen!'}`);
  console.log('═'.repeat(60) + '\n');

  // ── 1. Verify artwork is still in expected state ─────────────────────────
  console.log('Step 1: Verify artwork state...');
  const { data: artwork, error: artErr } = await (admin as any)
    .from('artworks')
    .select('id, title, artist_name, certificate_type, certificate_status, is_sold, sold_at, auction_history')
    .eq('id', ARTWORK_ID)
    .single();

  if (artErr || !artwork) {
    console.error('[Error] Could not fetch artwork:', artErr?.message);
    process.exit(1);
  }

  console.log('[Info] Artwork state:', {
    id: artwork.id,
    title: artwork.title,
    certificate_type: artwork.certificate_type,
    certificate_status: artwork.certificate_status,
    is_sold: artwork.is_sold,
    sold_at: artwork.sold_at,
  });

  if (artwork.is_sold) {
    console.log('[Warning] Artwork is already marked as sold — sale steps will be skipped.');
  }

  // ── 2. Cancel the wrong invite ────────────────────────────────────────────
  console.log('\nStep 2: Cancel wrong artist_coa_from_show invite to Jason Blake...');
  const { data: wrongInvite } = await (admin as any)
    .from('certificate_claim_invites')
    .select('id, claim_kind, status, invitee_email')
    .eq('id', WRONG_INVITE_ID)
    .single();

  if (!wrongInvite) {
    console.log('[Info] Wrong invite not found (may have already been cleaned up).');
  } else {
    console.log('[Info] Found wrong invite:', wrongInvite);
    if (wrongInvite.status === 'cancelled') {
      console.log('[Info] Invite already cancelled — skipping.');
    } else {
      log('Cancelling wrong invite', { id: WRONG_INVITE_ID, was_status: wrongInvite.status });
      if (!DRY_RUN) {
        const { error } = await (admin as any)
          .from('certificate_claim_invites')
          .update({ status: 'cancelled' })
          .eq('id', WRONG_INVITE_ID);
        if (error) {
          console.error('[Error] Failed to cancel invite:', error.message);
          process.exit(1);
        }
        console.log('[Success] Wrong invite cancelled.');
      }
    }
  }

  // ── 3. Mark artwork as sold ───────────────────────────────────────────────
  if (!artwork.is_sold) {
    console.log('\nStep 3: Mark artwork as sold...');
    const saleUpdate = {
      is_sold: true,
      sold_by: GALLERY_NAME,
      sold_by_account_id: GALLERY_ACCOUNT_ID,
      sold_to_account_id: BUYER_ACCOUNT_ID,
      sold_to_email: BUYER_EMAIL,
      sold_to_name: BUYER_NAME,
      sold_at: SALE_DATE,
      updated_by: GALLERY_ACCOUNT_ID,
    };
    log('Updating artworks row', saleUpdate);
    if (!DRY_RUN) {
      const { error } = await (admin as any)
        .from('artworks')
        .update(saleUpdate)
        .eq('id', ARTWORK_ID);
      if (error) {
        console.error('[Error] Failed to update artwork:', error.message);
        process.exit(1);
      }
      console.log('[Success] Artwork marked as sold.');
    }
  } else {
    console.log('\nStep 3: Skipped (already sold).');
  }

  // ── 4. Insert sales_ledger row ────────────────────────────────────────────
  console.log('\nStep 4: Insert sales_ledger row...');
  const { data: existingSale } = await (admin as any)
    .from('sales_ledger')
    .select('id')
    .eq('artwork_id', ARTWORK_ID)
    .maybeSingle();

  if (existingSale) {
    console.log('[Info] sales_ledger row already exists — skipping.');
  } else {
    const ledgerRow = {
      artwork_id: ARTWORK_ID,
      sold_by_account_id: GALLERY_ACCOUNT_ID,
      sold_to_account_id: BUYER_ACCOUNT_ID,
      sold_to_email: BUYER_EMAIL,
      sold_to_name: BUYER_NAME,
      price_cents: null,
      currency: 'USD',
      sold_at: SALE_DATE,
      recorded_by: GALLERY_ACCOUNT_ID,
      notes: `Sale at ${GALLERY_NAME}, ${SALE_DATE_DISPLAY}`,
      metadata: { source: 'remediation_script', gallery_profile_id: GALLERY_PROFILE_ID },
    };
    log('Inserting sales_ledger row', ledgerRow);
    if (!DRY_RUN) {
      const { error } = await (admin as any).from('sales_ledger').insert(ledgerRow);
      if (error) {
        console.error('[Error] Failed to insert sales_ledger:', error.message);
        process.exit(1);
      }
      console.log('[Success] sales_ledger row inserted.');
    }
  }

  // ── 5. Insert provenance_event of type "sale" ─────────────────────────────
  console.log('\nStep 5: Insert provenance_event...');
  const { data: existingEvent } = await (admin as any)
    .from('provenance_events')
    .select('id')
    .eq('artwork_id', ARTWORK_ID)
    .eq('event_type', 'sale')
    .maybeSingle();

  if (existingEvent) {
    console.log('[Info] provenance_event (sale) already exists — skipping.');
  } else {
    const eventRow = {
      artwork_id: ARTWORK_ID,
      event_type: 'sale',
      actor_account_id: GALLERY_ACCOUNT_ID,
      actor_name: GALLERY_NAME,
      event_date: SALE_DATE,
      metadata: {
        source: 'remediation_script',
        sold_by_display: GALLERY_NAME,
        sold_by_account_id: GALLERY_ACCOUNT_ID,
        sold_to_account_id: BUYER_ACCOUNT_ID,
        sold_to_email: BUYER_EMAIL,
        sold_to_name: BUYER_NAME,
        price_cents: null,
        currency: 'USD',
        gallery_profile_id: GALLERY_PROFILE_ID,
      },
    };
    log('Inserting provenance_event', eventRow);
    if (!DRY_RUN) {
      const { error } = await (admin as any).from('provenance_events').insert(eventRow);
      if (error) {
        console.error('[Error] Failed to insert provenance_event:', error.message);
        process.exit(1);
      }
      console.log('[Success] provenance_event inserted.');
    }
  }

  // ── 6. Backfill auction_history ───────────────────────────────────────────
  console.log('\nStep 6: Backfill auction_history...');
  const saleLine = `Sold to ${BUYER_NAME} at ${GALLERY_NAME}, ${SALE_DATE_DISPLAY}`;
  const existingHistory = (artwork.auction_history ?? '').trim();

  if (existingHistory.includes(saleLine)) {
    console.log('[Info] Auction history already contains sale line — skipping.');
  } else {
    const updatedHistory = existingHistory ? `${existingHistory}\n${saleLine}` : saleLine;
    log('Updating auction_history', { new_value: updatedHistory });
    if (!DRY_RUN) {
      const { error } = await (admin as any)
        .from('artworks')
        .update({ auction_history: updatedHistory })
        .eq('id', ARTWORK_ID);
      if (error) {
        console.error('[Error] Failed to update auction_history:', error.message);
        process.exit(1);
      }
      console.log('[Success] auction_history updated.');
    }
  }

  // ── 7. Send correct artist invite to Bryson Brooks ────────────────────────
  console.log('\nStep 7: Send correct artist_coa_from_show invite to Bryson Brooks...');
  const { data: existingArtistInvite } = await (admin as any)
    .from('certificate_claim_invites')
    .select('id, status')
    .eq('source_artwork_id', ARTWORK_ID)
    .eq('invitee_email', ARTIST_EMAIL)
    .eq('claim_kind', 'artist_coa_from_show')
    .in('status', ['sent', 'pending', 'consumed'])
    .maybeSingle();

  if (existingArtistInvite) {
    console.log('[Info] Bryson already has an artist invite:', existingArtistInvite);
  } else {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    const inviteRow = {
      source_artwork_id: ARTWORK_ID,
      claim_kind: 'artist_coa_from_show',
      invitee_email: ARTIST_EMAIL,
      token_hash: tokenHash,
      batch_id: randomUUID(),
      status: 'sent',
      expires_at: expiresAt,
      created_by: GALLERY_ACCOUNT_ID,
      provenance_update_request_id: null,
    };
    log('Inserting artist invite for Bryson Brooks', { ...inviteRow, token_hash: '***', token: token.slice(0, 8) + '...' });

    if (!DRY_RUN) {
      const { error } = await (admin as any).from('certificate_claim_invites').insert(inviteRow);
      if (error) {
        console.error('[Error] Failed to insert artist invite:', error.message);
        process.exit(1);
      }

      // Send email via the Resend API (requires RESEND_API_KEY)
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const claimUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://provenance.so'}/claim/certificate?token=${token}`;
        const emailPayload = {
          from: 'Provenance <noreply@provenance.so>',
          to: [ARTIST_EMAIL],
          subject: `Complete your Certificate of Authenticity — ${artwork.title}`,
          html: `
            <p>Hi Bryson,</p>
            <p>${GALLERY_NAME} has invited you to complete your Certificate of Authenticity for
            &ldquo;${artwork.title}&rdquo;. Sign in with this email address and accept to create
            your certificate — it will be automatically linked to the existing provenance record.</p>
            <p><a href="${claimUrl}" style="background:#4A2F25;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold;">Complete certificate</a></p>
            <p style="color:#888;font-size:12px;">This link expires on ${new Date(expiresAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}.</p>
          `,
        };

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload),
        });

        if (res.ok) {
          console.log('[Success] Artist invite email sent to', ARTIST_EMAIL);
        } else {
          const body = await res.text();
          console.error('[Warning] Artist invite email failed:', res.status, body);
          console.log('[Note] Invite row was inserted — Bryson can claim via the portal.');
        }
      } else {
        console.log('[Warning] RESEND_API_KEY not set — invite row inserted but email NOT sent.');
        console.log('[Note] Token for Bryson (share manually or set RESEND_API_KEY):', token);
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  Summary');
  console.log('═'.repeat(60));
  console.log(`
  1. Wrong invite (artist_coa_from_show → Jason Blake): CANCELLED
  2. Artwork marked as sold to Jason Blake at Fl!ght, Apr 23 2026
  3. sales_ledger row created
  4. provenance_event (sale) created
  5. auction_history backfilled with sale line
  6. Correct artist invite sent to brysonbrooks2025@gmail.com

  ⚠  IMPORTANT: Jason Blake's Certificate of Ownership invite CANNOT be sent
     until Bryson Brooks accepts his CoA. Once Bryson claims it, the gallery
     (or Bryson) can invite Jason from the CoA's certificate page using
     "Invite owner (email)" → enter jasonrobertblake@gmail.com.

  Jason Blake's account: ${BUYER_ACCOUNT_ID} (role: collector)
  Artwork: ${ARTWORK_ID} ("${artwork.title}")
  Gallery: ${GALLERY_PROFILE_ID} (Fl!ght)
  Artist: ${ARTIST_ACCOUNT_ID} (brysonbrooks2025@gmail.com)
  `);

  if (DRY_RUN) {
    console.log('  This was a DRY RUN. Re-run with DRY_RUN=false to apply changes.\n');
  } else {
    console.log('  All changes applied to production.\n');
  }
}

main().catch((err) => {
  console.error('[Remediate] Fatal error:', err);
  process.exit(1);
});
