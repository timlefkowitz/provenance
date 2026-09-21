/* eslint-disable @typescript-eslint/no-explicit-any -- subscriptions/artworks tables not in generated DB types */
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import OpenAI from 'openai';
import { sendEmail } from '~/lib/email';
import {
  buildBulletproofButtonTable,
  buildEmailHtml,
  escapeHtml,
} from '~/lib/email-layout';
import type { EmailTheme } from '~/lib/email-layout';
import { getResolvedEmailTheme } from '~/lib/email-templates-store';

import { constantTimeEquals } from '~/lib/security/constant-time';
import { asUntyped } from '~/lib/supabase-untyped';
import {
  buildArtistDigest,
  loadDigestArtists,
  loadOpenCallCandidates,
  type ArtistDigest,
  type DigestArtist,
  type DigestItem,
} from '~/lib/weekly-digest';

export const runtime = 'nodejs';
// One LLM call per recipient; leave headroom for the whole Monday batch.
export const maxDuration = 300;

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
 *    receive a personalised digest: open calls matching their location and
 *    medium, plus grants/residencies the LLM picks from their CV and profile
 *    (see ~/lib/weekly-digest). Nothing is sent if there is nothing to show.
 *    Testing: GET ?digestTo=<email> bypasses the Monday check and sends only
 *    to that (eligible) user.
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
  return constantTimeEquals(header.slice(7), secret);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';

// ─── Trial nudge ─────────────────────────────────────────────────────────────

async function sendTrialNudges(): Promise<{ sent: number; skipped: number }> {
  const admin = asUntyped(getSupabaseServerAdminClient()) as any;
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

  const theme = await getResolvedEmailTheme();
  let sent = 0;
  let skipped = 0;

  for (const sub of trials ?? []) {
    const meta = (sub.metadata as Record<string, unknown>) ?? {};
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

    const html = buildTrialNudgeHtml(name, daysLeft, theme);

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

function buildTrialNudgeHtml(name: string, daysLeft: number, theme: EmailTheme): string {
  const { ink, wine, inkMuted, fontFamily, fontFamilyHeading } = theme;

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

const DIGEST_CONCURRENCY = 5;

async function sendWeeklyDigest(opts: {
  force: boolean;
  onlyEmail: string | null;
}): Promise<{ sent: number; skipped: number }> {
  const now = new Date();
  // Only send on Mondays (unless forced for testing)
  if (!opts.force && now.getUTCDay() !== 1) {
    console.log('[CRON/lifecycle-emails] digest skipped — not Monday');
    return { sent: 0, skipped: 0 };
  }

  const admin = asUntyped(getSupabaseServerAdminClient());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Active / trialing artist subscribers
  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id')
    .in('status', ['active', 'trialing'])
    .or(`current_period_end.is.null,current_period_end.gte.${now.toISOString()}`)
    .eq('role', 'artist');

  if (!subs?.length) return { sent: 0, skipped: 0 };

  // Filter to users who were active in the last 30 days via user_presence
  const userIds = (subs as { user_id: string }[]).map((s) => s.user_id);
  const { data: activePresence } = await admin
    .from('user_presence')
    .select('user_id')
    .in('user_id', userIds)
    .gte('last_seen_at', thirtyDaysAgo);

  const activeUserIds = [...new Set((activePresence ?? []).map((p: { user_id: string }) => p.user_id))];
  if (!activeUserIds.length) return { sent: 0, skipped: 0 };

  let accountsQuery = admin.from('accounts').select('id, email, name').in('id', activeUserIds);
  if (opts.onlyEmail) accountsQuery = accountsQuery.eq('email', opts.onlyEmail);
  const { data: accounts } = await accountsQuery;
  if (!accounts?.length) return { sent: 0, skipped: 0 };

  const recipientIds = accounts.map((a: { id: string }) => a.id);
  const [artists, openCallCandidates] = await Promise.all([
    loadDigestArtists(admin, recipientIds),
    loadOpenCallCandidates(admin, now),
  ]);

  const theme = await getResolvedEmailTheme();

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) console.error('[CRON/lifecycle-emails] OPENAI_API_KEY not set — digest will have no AI-found grants');
  const openai = apiKey ? new OpenAI({ apiKey }) : null;

  let sent = 0;
  let skipped = 0;

  const sendOne = async (account: { id: string; email: string | null; name: string | null }) => {
    if (!account.email) { skipped++; return; }
    try {
      const artist = artists.get(account.id);
      const digest = await buildArtistDigest({
        admin,
        openai,
        artist,
        userId: account.id,
        openCallCandidates,
        siteUrl: SITE_URL,
        now,
      });

      // Never send an empty digest.
      if (!digest.openCalls.length && !digest.grants.length) {
        console.log('[CRON/lifecycle-emails] digest skipped — nothing to show', { userId: account.id });
        skipped++;
        return;
      }

      await sendEmail({
        to: account.email,
        subject: 'Your weekly Provenance digest — grants & open calls',
        html: buildDigestHtml(account.name || account.email.split('@')[0], digest, theme, artist),
      });
      console.log('[CRON/lifecycle-emails] digest sent', {
        userId: account.id,
        openCalls: digest.openCalls.length,
        grants: digest.grants.length,
      });
      sent++;
    } catch (err) {
      console.error('[CRON/lifecycle-emails] digest failed for user', { userId: account.id, err });
      skipped++;
    }
  };

  for (let i = 0; i < accounts.length; i += DIGEST_CONCURRENCY) {
    await Promise.all(accounts.slice(i, i + DIGEST_CONCURRENCY).map(sendOne));
  }

  return { sent, skipped };
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '';
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function buildDigestHtml(
  name: string,
  digest: ArtistDigest,
  theme: EmailTheme,
  artist?: DigestArtist,
): string {
  const { ink, wine, inkMuted, cardBorder, fontFamily, fontFamilyHeading } = theme;

  const safeName = escapeHtml(name);
  const context = [artist?.medium, artist?.location].filter(Boolean).join(' · ');

  const buildSection = (sectionTitle: string, items: DigestItem[], browseHref: string, browseLabel: string): string => {
    if (!items.length) return '';
    const rows = items
      .map((item) => {
        const title = escapeHtml(item.title);
        const titleHtml = item.url
          ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" style="color:${wine};text-decoration:none;">${title}</a>`
          : title;
        const meta = [item.deadline ? `Deadline ${formatDeadline(item.deadline)}` : '', item.detail ?? '']
          .filter(Boolean)
          .map(escapeHtml)
          .join(' &middot; ');
        return `
  <tr>
    <td style="padding:16px 0;border-bottom:1px solid ${cardBorder};">
      <p style="margin:0;font-family:${fontFamily};font-size:16px;font-weight:600;color:${wine};">${titleHtml}</p>
      ${meta ? `<p style="margin:4px 0 0;font-family:${fontFamily};font-size:14px;line-height:1.55;color:${inkMuted};">${meta}</p>` : ''}
    </td>
  </tr>`;
      })
      .join('');

    return `
<h3 style="margin:28px 0 4px;font-family:${fontFamilyHeading};font-size:17px;font-weight:600;color:${ink};line-height:1.4;">${escapeHtml(sectionTitle)}</h3>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;border-top:1px solid ${cardBorder};">${rows}
</table>
<p style="margin:12px 0 0;font-family:${fontFamily};font-size:14px;line-height:1.6;"><a href="${browseHref}" target="_blank" rel="noopener noreferrer" style="color:${wine};text-decoration:none;font-weight:500;">${escapeHtml(browseLabel)} &rarr;</a></p>`;
  };

  const intro = context
    ? `Hi ${safeName}, here are this week's grants and open calls picked for your practice (${escapeHtml(context)}).`
    : `Hi ${safeName}, here's what's open this week.`;

  const body = `
<h2 style="margin:0 0 16px;font-family:${fontFamilyHeading};font-size:21px;font-weight:600;color:${wine};line-height:1.3;letter-spacing:-0.01em;">Your weekly digest</h2>
<p style="margin:0 0 16px;font-family:${fontFamily};font-size:16px;line-height:1.7;color:${ink};">${intro}</p>
${buildSection('Open calls', digest.openCalls, `${SITE_URL}/open-calls/browse`, 'Browse all open calls')}
${buildSection('Grants &amp; residencies', digest.grants, `${SITE_URL}/grants`, 'Find more grants')}
${buildBulletproofButtonTable(`${SITE_URL}/grants`, 'Open Grants Assistant', theme)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 24px;border-collapse:collapse;"><tr><td height="1" bgcolor="${cardBorder}" style="height:1px;line-height:1px;font-size:1px;background-color:${cardBorder};">&nbsp;</td></tr></table>
<p style="margin:0 0 16px;font-family:${fontFamily};font-size:14px;line-height:1.6;color:${inkMuted};">Grant suggestions are AI-generated from your profile &mdash; please confirm deadlines and eligibility on each program's official site.</p>
<p style="margin:0 0 16px;font-family:${fontFamily};font-size:16px;line-height:1.7;color:${ink};">Best,<br />The Provenance team</p>
<p style="margin:0;font-family:${fontFamily};font-size:12px;line-height:1.6;color:${inkMuted};"><a href="${SITE_URL}/settings" target="_blank" rel="noopener noreferrer" style="color:${inkMuted};text-decoration:underline;">Manage email preferences</a></p>`;

  return buildEmailHtml('Your weekly Provenance digest', `<div>${body}</div>`, theme);
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

  const digestTo = request.nextUrl.searchParams.get('digestTo')?.trim() || null;

  try {
    results.weeklyDigest = await sendWeeklyDigest({ force: Boolean(digestTo), onlyEmail: digestTo });
  } catch (err) {
    console.error('[CRON/lifecycle-emails] weekly digest failed', err);
    results.weeklyDigestError = String(err);
  }

  console.log('[CRON/lifecycle-emails] done', results);
  return NextResponse.json(results);
}
