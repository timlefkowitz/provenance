'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { requireAdminUserId } from '~/lib/admin';
import { asUntyped } from '~/lib/supabase-untyped';
import type { ReportTargetType } from '~/lib/moderation/report-types';

export type ReportStatus = 'open' | 'actioned' | 'dismissed';

export type AdminContentReport = {
  id: string;
  source: 'content' | 'grant';
  target_type: ReportTargetType | 'grant';
  target_id: string;
  target_owner_id: string | null;
  target_owner_name: string | null;
  reporter_id: string;
  reporter_name: string | null;
  reason: string;
  details: string | null;
  page_url: string | null;
  status: ReportStatus;
  resolution: string | null;
  created_at: string;
};

type ActionResult = { ok: true } | { ok: false; error: string };

export async function listContentReports(filter: ReportStatus | 'all' = 'open'): Promise<
  { ok: true; reports: AdminContentReport[]; openCount: number } | { ok: false; error: string }
> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };
  const admin = asUntyped(getSupabaseServerAdminClient());

  let query = admin
    .from('content_reports')
    .select('id, reporter_id, target_type, target_id, target_owner_id, reason, details, page_url, status, resolution, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (filter !== 'all') query = query.eq('status', filter);

  // grant_reports predates content_reports and has no status column; every
  // row is treated as open until the grant is hidden or the report deleted.
  const [{ data: rows, error }, { data: grantRows, error: grantError }, { count: openCount }] = await Promise.all([
    query,
    filter === 'open' || filter === 'all'
      ? admin.from('grant_reports').select('id, grant_id, user_id, reason, created_at').order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    admin.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  if (error || grantError) {
    console.error('[AdminReports] list failed', error ?? grantError);
    return { ok: false, error: 'Failed to load reports.' };
  }

  const userIds = new Set<string>();
  for (const r of rows ?? []) {
    userIds.add(r.reporter_id);
    if (r.target_owner_id) userIds.add(r.target_owner_id);
  }
  for (const g of grantRows ?? []) userIds.add(g.user_id);
  const { data: accounts } = userIds.size
    ? await admin.from('accounts').select('id, name, email').in('id', [...userIds])
    : { data: [] };
  const nameOf = new Map<string, string | null>(
    (accounts ?? []).map((a: { id: string; name: string | null; email: string | null }) => [a.id, a.name || a.email]),
  );

  const reports: AdminContentReport[] = [
    ...(rows ?? []).map((r: Record<string, string | null>) => ({
      id: r.id!,
      source: 'content' as const,
      target_type: r.target_type as ReportTargetType,
      target_id: r.target_id!,
      target_owner_id: r.target_owner_id,
      target_owner_name: r.target_owner_id ? nameOf.get(r.target_owner_id) ?? null : null,
      reporter_id: r.reporter_id!,
      reporter_name: nameOf.get(r.reporter_id!) ?? null,
      reason: r.reason!,
      details: r.details,
      page_url: r.page_url,
      status: r.status as ReportStatus,
      resolution: r.resolution,
      created_at: r.created_at!,
    })),
    ...(grantRows ?? []).map((g: { id: string; grant_id: string; user_id: string; reason: string; created_at: string }) => ({
      id: g.id,
      source: 'grant' as const,
      target_type: 'grant' as const,
      target_id: g.grant_id,
      target_owner_id: null,
      target_owner_name: null,
      reporter_id: g.user_id,
      reporter_name: nameOf.get(g.user_id) ?? null,
      reason: 'other',
      details: g.reason,
      page_url: '/grants',
      status: 'open' as const,
      resolution: null,
      created_at: g.created_at,
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return { ok: true, reports, openCount: (openCount ?? 0) + (grantRows?.length ?? 0) };
}

async function resolveReport(reportId: string, adminId: string, status: ReportStatus, resolution: string) {
  const { error } = await asUntyped(getSupabaseServerAdminClient())
    .from('content_reports')
    .update({ status, resolution, resolved_by: adminId, resolved_at: new Date().toISOString() })
    .eq('id', reportId);
  if (error) console.error('[AdminReports] resolve failed', { reportId, error });
  return error;
}

export async function dismissReport(reportId: string, source: 'content' | 'grant'): Promise<ActionResult> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };
  const error =
    source === 'grant'
      ? (await asUntyped(getSupabaseServerAdminClient()).from('grant_reports').delete().eq('id', reportId)).error
      : await resolveReport(reportId, adminId, 'dismissed', 'No violation');
  if (error) return { ok: false, error: 'Could not dismiss the report.' };
  console.log('[AdminReports] dismissed', { reportId, source, adminId });
  revalidatePath('/admin/reports');
  return { ok: true };
}

/** Removes the reported item from public view. */
export async function hideReportedContent(report: {
  id: string;
  source: 'content' | 'grant';
  target_type: AdminContentReport['target_type'];
  target_id: string;
}): Promise<ActionResult> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };
  const admin = asUntyped(getSupabaseServerAdminClient());
  const id = report.target_id;

  let error: unknown = null;
  switch (report.target_type) {
    case 'artwork':
      ({ error } = await admin.from('artworks').update({ is_public: false }).eq('id', id));
      break;
    case 'collectible':
      ({ error } = await admin.from('collectibles').update({ is_public: false }).eq('id', id));
      break;
    case 'exhibition':
      ({ error } = await admin.from('exhibitions').update({ published_at: null }).eq('id', id));
      break;
    case 'profile':
    case 'user':
      // Claimed profiles are reported by account id, unclaimed ones by profile id.
      ({ error } = await admin.from('user_profiles').update({ is_active: false }).or(`id.eq.${id},user_id.eq.${id}`));
      break;
    case 'grant':
      ({ error } = await admin.from('artist_grants').update({ is_community: false }).eq('id', id));
      break;
  }
  if (error) {
    console.error('[AdminReports] hide failed', { report, error });
    return { ok: false, error: 'Could not hide the content.' };
  }

  if (report.source === 'grant') {
    await admin.from('grant_reports').delete().eq('grant_id', id);
  } else {
    // Close every open report on the same item, not just this one.
    await admin
      .from('content_reports')
      .update({ status: 'actioned', resolution: 'Content hidden', resolved_by: adminId, resolved_at: new Date().toISOString() })
      .eq('target_type', report.target_type)
      .eq('target_id', id)
      .eq('status', 'open');
  }
  console.log('[AdminReports] content hidden', { reportId: report.id, targetType: report.target_type, targetId: id, adminId });
  revalidatePath('/admin/reports');
  return { ok: true };
}

/**
 * Bans the owner from signing in and hides everything they've published.
 * Reversible from Supabase (unban + re-publish), but intended for egregious
 * or repeated violations.
 */
export async function suspendReportedUser(reportId: string, userId: string): Promise<ActionResult> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };
  if (userId === adminId) return { ok: false, error: 'You can’t suspend yourself.' };

  const adminClient = getSupabaseServerAdminClient();
  const { error: banError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
  if (banError) {
    console.error('[AdminReports] ban failed', { userId, banError });
    return { ok: false, error: 'Could not suspend the user.' };
  }

  const admin = asUntyped(adminClient);
  const results = await Promise.all([
    admin.from('artworks').update({ is_public: false }).eq('account_id', userId),
    admin.from('collectibles').update({ is_public: false }).eq('account_id', userId),
    admin.from('exhibitions').update({ published_at: null }).eq('gallery_id', userId),
    admin.from('user_profiles').update({ is_active: false }).eq('user_id', userId),
    admin.from('artist_grants').update({ is_community: false }).eq('shared_by', userId),
  ]);
  for (const r of results) if (r.error) console.error('[AdminReports] suspend cleanup failed', r.error);

  await admin
    .from('content_reports')
    .update({ status: 'actioned', resolution: 'User suspended', resolved_by: adminId, resolved_at: new Date().toISOString() })
    .eq('target_owner_id', userId)
    .eq('status', 'open');

  console.log('[AdminReports] user suspended', { reportId, userId, adminId });
  revalidatePath('/admin/reports');
  return { ok: true };
}
