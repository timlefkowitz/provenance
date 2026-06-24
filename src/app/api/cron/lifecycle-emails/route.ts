/* eslint-disable @typescript-eslint/no-explicit-any -- subscriptions/artworks tables not in generated DB types */
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { sendEmail } from '~/lib/email';
import {
  buildBulletproofButtonTable,
  buildEmailHtml,
  escapeHtml,
} from '~/lib/email-layout';
import { getPresetThemeDefaults } from '~/lib/email-layout-presets';

export const runtime = 'nodejs';

/**
 * Lifecycle email cron — runs daily at 10:00 UTC.
 *
 * Sends two categories of automated lifecycle emails via Resend:
 *
 * 1. TRIAL CONVERSION NUDGE (Day 7)
 *    Users with an active trial whose trial_end is exactly 7 days away and
 *    who have not yet subscribed are sent a personalised "Your trial ends soon"
 *    email with a direct upgrade CTA.
 *    Deduped: stores 'trial_nudge_sent_day7' flag in subscription metadata.
 *
 * 2. WEEKLY GRANTS / OPEN-CALLS DIGEST (every Monday)
 *    Artist-role users who have logged in at least once in the past 30 days
 *    receive a digest of the 5 most recent open grant opportunities and open
 *    calls. Keeps the product sticky without needing the user to log in.
 *
 * Auth: protected by CRON_SECRET (Authorization: Bearer ...).
 */

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[CRON/lifecycle-emails] CRON_SECRET is not set');
    return false;
  }
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return false;
  return header.slice(7) === secret;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
const FROM = process.env.RESEND_FROM || 'Provenance <noreply@provenance.guru>';

// ─── Trial nudge ─────────────────────────────────────────────────────────────

async function sendTrialNudges(): Promise<{ sent: number; skipped: number }> {
  const admin = getSupabaseServerAdminClient() as any;
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Find trialing subscriptions whose trial_end is within the next 7-8 days
  // and where the nudge hasn't been sent yet.
  const windowStart = new Date(sevenDaysFromNow.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(sevenDaysFromNow.getTime() + 12 * 60 * 60 * 1000).toISOString();

  const { data: trials, error } = await admin
    .from('subscriptions')
    .select('id, user_id, trial_end, metadata')
    .eq('status', 'trialing')
    .gte('trial_end', windowStart)
    .lte('trial_end', windowEnd);

  if (error) {
    console.error('[CRON/lifecycle-emails] trial query failed', error);
    return { sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;

  for (const sub of trials ?? []) {
    const meta = (sub.metadata as Record<string, any>) ?? {};
    if (meta.trial_nudge_sent_day7) {
      skipped++;
      continue;
    }

    // Get user email
    const { data: account } = await admin
      .from('accounts')
      .select('email, name')
      .eq('id', sub.user_id)
      .single();

    if (!account?.email) { skipped++; continue; }

    const name = account.name || account.email.split('@')[0];
    const trialEnd = new Date(sub.trial_end);
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const html = buildTrialNudgeHtml(name, daysLeft);

    await sendEmail({
      to: account.email,
      subject: `Your Provenance trial ends in ${daysLeft} days`,
      html,
    });

    // Mark nudge as sent
    await admin
      .from('subscriptions')
      .update({ metadata: { ...meta, trial_nudge_sent_day7: true } })
      .eq('id', sub.id);

    console.log('[CRON/lifecycle-emails] trial nudge sent', { userId: sub.user_id, daysLeft });
    sent++;
  }

  return { sent, skipped };
}

function buildTrialNudgeHtml(name: string, daysLeft: number): string {
  const theme = getPresetThemeDefaults('minimal');
  const { ink, wine, inkMuted, surfaceMuted, fontFamily, fontFamilyHeading } = theme;

  const safeName = escapeHtml(name);
  const dayWord = daysLeft === 1 ? 'day' : 'days';

  const featureRow = (text: string) =>
    `<tr>
      <td width="20" style="padding:8px 0;vertical-align:top;">
        <span style="font-family:${fontFamily};font-size:14px;color:${wine};">&#9656;</span>
      </td>
      <td style="padding:8px 0;font-family:${fontFamily};font-size:15px;line-height:1.6;color:${ink};">${text}</td>
    </tr>`;

  const innerHtml = `
<h1 style="margin:0 0 8px;font-family:${fontFamilyHeading};font-size:26px;font-weight:700;color:${ink};line-height:1.25;">Your trial ends in ${daysLeft} ${dayWord}</h1>
<p style="margin:0 0 6px;font-family:${fontFamily};font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${wine};">Action required</p>
<p style="margin:0 0 24px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};">
  Hi ${safeName}, your 14-day Provenance trial is winding down. Don't let your access to grants, CRM, open calls, and white-label sites lapse — subscribe now and keep everything you've built.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-collapse:collapse;">
  ${featureRow('Grants assistant &amp; AI-powered CV tools')}
  ${featureRow('Opportunities &amp; Relationships CRM')}
  ${featureRow('Open calls for your region')}
  ${featureRow('White-label artist or gallery website')}
</table>
${buildBulletproofButtonTable(`${SITE_URL}/subscription`, 'Upgrade Now', theme)}
<p style="margin:16px 0 0;font-family:${fontFamily};font-size:13px;line-height:1.6;color:${inkMuted};">Plans start at $10/month. Annual plans save ~2 months.</p>`;

  return buildEmailHtml(`Your Provenance trial ends in ${daysLeft} ${dayWord}`, `<div>${innerHtml}</div>`, theme);
}

// ─── Weekly digest ────────────────────────────────────────────────────────────

async function sendWeeklyDigest(): Promise<{ sent: number; skipped: number }> {
  const now = new Date();
  // Only send on Mondays
  if (now.getUTCDay() !== 1) {
    console.log('[CRON/lifecycle-emails] digest skipped — not Monday');
    return { sent: 0, skipped: 0 };
  }

  const admin = getSupabaseServerAdminClient() as any;
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Active / trialing artist subscribers who were seen in the last 30 days
  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id')
    .in('status', ['active', 'trialing'])
    .or(`current_period_end.is.null,current_period_end.gte.${now.toISOString()}`)
    .eq('role', 'artist');

  if (!subs?.length) return { sent: 0, skipped: 0 };

  // Filter to users who were active in the last 30 days via user_presence
  const userIds = (subs as any[]).map((s) => s.user_id);
  const { data: activePresence } = await admin
    .from('user_presence')
    .select('user_id')
    .in('user_id', userIds)
    .gte('last_seen_at', thirtyDaysAgo);

  const activeUserIds = new Set((activePresence ?? []).map((p: any) => p.user_id));

  if (!activeUserIds.size) return { sent: 0, skipped: 0 };

  // Fetch 5 most recent open calls
  const { data: openCalls } = await admin
    .from('open_calls')
    .select('id, title, deadline, description')
    .gte('deadline', now.toISOString())
    .order('deadline', { ascending: true })
    .limit(5);

  // Fetch 5 most recent grants
  const { data: grants } = await admin
    .from('artist_grants')
    .select('id, title, deadline, description')
    .gte('deadline', now.toISOString())
    .order('deadline', { ascending: true })
    .limit(5)
    .maybeSingle()
    .then(() => admin.from('artist_grants').select('id, title, deadline, description').gte('deadline', now.toISOString()).order('deadline', { ascending: true }).limit(5));

  // Get accounts for active users
  const activeUserIdsList = [...activeUserIds];
  const { data: accounts } = await admin
    .from('accounts')
    .select('id, email, name')
    .in('id', activeUserIdsList);

  let sent = 0;
  let skipped = 0;

  for (const account of accounts ?? []) {
    if (!account.email) { skipped++; continue; }

    const html = buildDigestHtml(
      account.name || account.email.split('@')[0],
      openCalls ?? [],
      grants ?? [],
    );

    await sendEmail({
      to: account.email,
      subject: 'Your weekly Provenance digest — grants &amp; open calls',
      html,
    });

    console.log('[CRON/lifecycle-emails] digest sent', { userId: account.id });
    sent++;
  }

  return { sent, skipped };
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '';
  try {
    return new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function buildDigestHtml(name: string, openCalls: any[], grants: any[]): string {
  const theme = getPresetThemeDefaults('minimal');
  const { ink, wine, inkMuted, cardBorder, fontFamily, fontFamilyHeading } = theme;

  const safeName = escapeHtml(name);

  const buildSection = (
    sectionTitle: string,
    items: any[],
    browseHref: string,
    browseLabel: string,
  ): string => {
    if (!items.length) return '';
    const rows = items
      .map(
        (item) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid ${cardBorder};">
          <p style="margin:0 0 4px;font-family:${fontFamily};font-size:15px;font-weight:600;color:${ink};">${escapeHtml(item.title)}</p>
          ${item.deadline ? `<p style="margin:0;font-family:${fontFamily};font-size:12px;letter-spacing:0.06em;color:${wine};text-transform:uppercase;">Deadline: ${formatDeadline(item.deadline)}</p>` : ''}
        </td>
      </tr>`,
      )
      .join('');

    return `
<p style="margin:28px 0 4px;font-family:${fontFamily};font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${wine};">${escapeHtml(sectionTitle)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${cardBorder};border-collapse:collapse;">
  ${rows}
</table>
<p style="margin:10px 0 0;font-family:${fontFamily};font-size:13px;">
  <a href="${browseHref}" target="_blank" rel="noopener noreferrer" style="color:${wine};text-decoration:none;font-weight:500;">${escapeHtml(browseLabel)} &rarr;</a>
</p>`;
  };

  const innerHtml = `
<h1 style="margin:0 0 4px;font-family:${fontFamilyHeading};font-size:26px;font-weight:700;color:${ink};line-height:1.25;">Your weekly digest</h1>
<p style="margin:0 0 20px;font-family:${fontFamily};font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${wine};">Grants &amp; open calls, curated for artists</p>
<p style="margin:0 0 4px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};">Hi ${safeName}, here's what's open this week.</p>
${buildSection('Open Calls', openCalls, `${SITE_URL}/open-calls/browse`, 'Browse all open calls')}
${buildSection('Grants', grants, `${SITE_URL}/grants`, 'Browse all grants')}
<p style="margin:28px 0 0;font-family:${fontFamily};font-size:12px;line-height:1.6;color:${inkMuted};">
  <a href="${SITE_URL}/settings" target="_blank" rel="noopener noreferrer" style="color:${inkMuted};text-decoration:underline;">Manage email preferences</a>
</p>`;

  return buildEmailHtml('Your weekly Provenance digest', `<div>${innerHtml}</div>`, theme);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  console.log('[CRON/lifecycle-emails] GET started');

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    results.trialNudge = await sendTrialNudges();
  } catch (err) {
    console.error('[CRON/lifecycle-emails] trial nudge failed', err);
    results.trialNudgeError = String(err);
  }

  try {
    results.weeklyDigest = await sendWeeklyDigest();
  } catch (err) {
    console.error('[CRON/lifecycle-emails] weekly digest failed', err);
    results.weeklyDigestError = String(err);
  }

  console.log('[CRON/lifecycle-emails] done', results);
  return NextResponse.json(results);
}
