'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { checkRateLimit } from '~/lib/rate-limit';
import { notifyAdmins } from '~/lib/admin-notify';
import { sendEmail } from '~/lib/email';
import {
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
  type ReportReason,
  type ReportTargetType,
} from '~/lib/moderation/report-types';

const MODERATION_EMAIL = process.env.MODERATION_EMAIL || 'hello@provenance.guru';

type Result = { success: true } | { success: false; error: string };

async function currentUserId(): Promise<string | null> {
  const { data: { user } } = await getSupabaseServerClient().auth.getUser();
  return user?.id ?? null;
}

export async function reportContent(input: {
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId?: string | null;
  reason: ReportReason;
  details?: string;
  pageUrl?: string;
}): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: 'Sign in to report content.' };

  if (!REPORT_TARGET_TYPES.includes(input.targetType) || !REPORT_REASONS.some((r) => r.value === input.reason)) {
    return { success: false, error: 'Invalid report.' };
  }
  if (!input.targetId || input.targetId.length > 200) {
    return { success: false, error: 'Invalid report.' };
  }

  const allowed = await checkRateLimit(
    { headers: await headers() },
    { keyPrefix: `content-report:${userId}`, maxPerWindow: 20, windowMs: 3_600_000 },
  );
  if (!allowed) return { success: false, error: 'Too many reports. Please try again later.' };

  const details = input.details?.trim().slice(0, 2000) || null;
  const { data, error } = await asUntyped(getSupabaseServerClient())
    .from('content_reports')
    .insert({
      reporter_id: userId,
      target_type: input.targetType,
      target_id: input.targetId,
      target_owner_id: input.targetOwnerId ?? null,
      reason: input.reason,
      details,
      page_url: input.pageUrl?.slice(0, 500) ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[Moderation] reportContent insert failed', { userId, error });
    return { success: false, error: 'Could not submit your report. Please try again.' };
  }

  const reportId = data.id as string;
  const reasonLabel = REPORT_REASONS.find((r) => r.value === input.reason)?.label ?? input.reason;
  console.log('[Moderation] content reported', { reportId, targetType: input.targetType, reason: input.reason });

  // Guideline 1.2 expects a timely response — alert admins in-app and by email.
  await Promise.all([
    notifyAdmins({
      title: 'New content report',
      message: `${reasonLabel} — ${input.targetType}${details ? `: ${details}` : ''}`,
      metadata: { kind: 'content_report', report_id: reportId, href: `/admin/reports#${reportId}` },
      logTag: 'Moderation',
    }),
    sendEmail({
      to: MODERATION_EMAIL,
      subject: `[Provenance] Content report: ${reasonLabel} (${input.targetType})`,
      html: `<p>A user reported a ${input.targetType} for <strong>${reasonLabel}</strong>.</p>
<p>Page: ${escapeHtml(input.pageUrl ?? '(unknown)')}</p>
${details ? `<p>Details: ${escapeHtml(details)}</p>` : ''}
<p>Review within 24 hours: <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.provenance.guru'}/admin/reports">/admin/reports</a></p>`,
    }).catch((err) => console.error('[Moderation] report email failed', err)),
  ]);

  return { success: true };
}

export async function blockUser(blockedId: string): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: 'Sign in to block users.' };
  if (!blockedId || blockedId === userId) return { success: false, error: 'You can’t block yourself.' };

  const { error } = await asUntyped(getSupabaseServerClient())
    .from('user_blocks')
    .upsert({ blocker_id: userId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });

  if (error) {
    console.error('[Moderation] blockUser failed', { userId, error });
    return { success: false, error: 'Could not block this user. Please try again.' };
  }

  // Remove follows in both directions so the blocked user's work leaves the
  // blocker's Following feed and they can't keep following the blocker.
  const admin = asUntyped(getSupabaseServerAdminClient());
  const { error: followErr } = await admin
    .from('user_follows')
    .delete()
    .or(`and(follower_id.eq.${userId},following_id.eq.${blockedId}),and(follower_id.eq.${blockedId},following_id.eq.${userId})`);
  if (followErr) console.error('[Moderation] blockUser follow cleanup failed', followErr);

  console.log('[Moderation] user blocked', { userId, blockedId });
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function unblockUser(blockedId: string): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: 'Sign in to manage blocked users.' };

  const { error } = await asUntyped(getSupabaseServerClient())
    .from('user_blocks')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', blockedId);

  if (error) {
    console.error('[Moderation] unblockUser failed', { userId, error });
    return { success: false, error: 'Could not unblock this user. Please try again.' };
  }
  console.log('[Moderation] user unblocked', { userId, blockedId });
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function listMyBlockedUsers(): Promise<{ id: string; name: string; blockedAt: string }[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const client = asUntyped(getSupabaseServerClient());
  const { data: rows } = await client
    .from('user_blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });
  const ids = (rows ?? []).map((r: { blocked_id: string }) => r.blocked_id);
  if (ids.length === 0) return [];

  const { data: accounts } = await asUntyped(getSupabaseServerAdminClient())
    .from('accounts')
    .select('id, name')
    .in('id', ids);
  const names = new Map((accounts ?? []).map((a: { id: string; name: string | null }) => [a.id, a.name]));
  return (rows ?? []).map((r: { blocked_id: string; created_at: string }) => ({
    id: r.blocked_id,
    name: names.get(r.blocked_id) || 'Unknown user',
    blockedAt: r.created_at,
  }));
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
