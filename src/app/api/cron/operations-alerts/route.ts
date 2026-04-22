/* eslint-disable @typescript-eslint/no-explicit-any -- operations/cron tables not in generated DB types */
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { insertProvenanceEventForOperations } from '~/lib/operations/operations-provenance';

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[CRON/operations-alerts] CRON_SECRET is not set');
    return false;
  }
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return false;
  }
  return header.slice(7) === secret;
}

/**
 * Daily job: 30-day expiry notifications + auto-expire past end_date.
 * Configure Vercel Cron to call with Authorization: Bearer $CRON_SECRET
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON/operations-alerts] started');
  const admin = getSupabaseServerAdminClient() as any;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  const todayStr = today.toISOString().slice(0, 10);
  const in30Str = in30.toISOString().slice(0, 10);

  let reminders = 0;
  let expirations = 0;
  let consignmentRem = 0;
  let consignmentExp = 0;

  const { data: dueLoans, error: loErr } = await admin
    .from('artwork_loan_agreements')
    .select('id, account_id, artwork_id, end_date, borrower_name, status, alert_sent_at')
    .eq('status', 'active')
    .not('end_date', 'is', null);
  if (loErr) {
    console.error('[CRON/operations-alerts] loans load', loErr);
  } else {
    for (const row of dueLoans ?? []) {
      const end = row.end_date as string;
      if (!end) {
        continue;
      }
      if (end < todayStr) {
        if (row.status === 'active') {
          const { error: u } = await admin
            .from('artwork_loan_agreements')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', row.id);
          if (u) {
            console.error('[CRON/operations-alerts] loan expire update', u);
            continue;
          }
          expirations += 1;
          if (row.artwork_id) {
            await insertProvenanceEventForOperations({
              artworkId: row.artwork_id as string,
              eventType: 'loan_return',
              actorAccountId: row.account_id as string,
              metadata: { loan_agreement_id: row.id, reason: 'auto_expired' },
            });
          }
        }
        continue;
      }
      if (end <= in30Str && end >= todayStr && !row.alert_sent_at) {
        const { error: nErr } = await admin.from('notifications').insert({
          user_id: row.account_id,
          type: 'loan_expiry_reminder',
          title: 'Loan end date approaching',
          message: `Loan agreement (borrower: ${(row as { borrower_name?: string }).borrower_name ?? '—'}) ends on ${end}. Review or renew in Operations.`,
          artwork_id: row.artwork_id,
          read: false,
          metadata: { loan_agreement_id: row.id, end_date: end },
        });
        if (nErr) {
          console.error('[CRON/operations-alerts] loan notification', nErr);
        } else {
          reminders += 1;
          await admin
            .from('artwork_loan_agreements')
            .update({ alert_sent_at: new Date().toISOString() })
            .eq('id', row.id);
        }
      }
    }
  }

  const { data: cons, error: cErr } = await admin
    .from('consignments')
    .select('id, account_id, artwork_id, end_date, consignee_name, status, alert_sent_at')
    .eq('status', 'active')
    .not('end_date', 'is', null);
  if (cErr) {
    console.error('[CRON/operations-alerts] consignments load', cErr);
  } else {
    for (const row of cons ?? []) {
      const end = row.end_date as string;
      if (!end) {
        continue;
      }
      if (end < todayStr) {
        if (row.status === 'active') {
          const { error: u } = await admin
            .from('consignments')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', row.id);
          if (u) {
            console.error('[CRON/operations-alerts] consignment expire', u);
            continue;
          }
          consignmentExp += 1;
        }
        continue;
      }
      if (end <= in30Str && end >= todayStr && !row.alert_sent_at) {
        const { error: nErr } = await admin.from('notifications').insert({
          user_id: row.account_id,
          type: 'consignment_expiry_reminder',
          title: 'Consignment end date approaching',
          message: `Consignment to ${(row as { consignee_name?: string }).consignee_name ?? '—'} ends on ${end}. Review in Operations.`,
          artwork_id: row.artwork_id,
          read: false,
          metadata: { consignment_id: row.id, end_date: end },
        });
        if (nErr) {
          console.error('[CRON/operations-alerts] consignment notification', nErr);
        } else {
          consignmentRem += 1;
          await admin
            .from('consignments')
            .update({ alert_sent_at: new Date().toISOString() })
            .eq('id', row.id);
        }
      }
    }
  }

  console.log('[CRON/operations-alerts] done', {
    loanReminders: reminders,
    loanExpirations: expirations,
    consignmentReminders: consignmentRem,
    consignmentExpired: consignmentExp,
  });

  return NextResponse.json({
    ok: true,
    loanReminders: reminders,
    loanExpirations: expirations,
    consignmentReminders: consignmentRem,
    consignmentsExpired: consignmentExp,
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
