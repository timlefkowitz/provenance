import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { inScanWindow, type ScanWindow } from '~/lib/exhibition-scan-stats';
import { asUntyped } from '~/lib/supabase-untyped';
import {
  computeViewStats,
  EMPTY_VIEW_STATS,
  viewStatsFromRpc,
  type ViewStats,
} from '~/lib/view-stats';

/** All-time view counts per certificate (holder's own views left out). */
export async function loadCertificateViewStats(artworkIds: string[]): Promise<Map<string, ViewStats>> {
  const out = new Map<string, ViewStats>();
  const ids = [...new Set(artworkIds)];
  if (ids.length === 0) return out;
  const admin = asUntyped(getSupabaseServerAdminClient());
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin.rpc('certificate_view_stats', {
      p_artwork_ids: ids.slice(i, i + 200),
    });
    if (error) {
      console.error('[Views] certificate_view_stats failed', { error });
      continue;
    }
    for (const row of (data ?? []) as Array<{ artwork_id: string; total: unknown; people: unknown; last_viewed_at: unknown }>) {
      out.set(row.artwork_id, viewStatsFromRpc(row));
    }
  }
  return out;
}

export async function loadOneCertificateViewStats(artworkId: string): Promise<ViewStats> {
  return (await loadCertificateViewStats([artworkId])).get(artworkId) ?? EMPTY_VIEW_STATS;
}

/** Page views of an exhibition (the team's own views left out). */
export async function loadExhibitionViewStats(exhibitionId: string): Promise<ViewStats> {
  const { data, error } = await asUntyped(getSupabaseServerAdminClient()).rpc(
    'exhibition_view_stats',
    { p_exhibition_id: exhibitionId },
  );
  if (error) {
    console.error('[Views] exhibition_view_stats failed', { exhibitionId, error });
    return EMPTY_VIEW_STATS;
  }
  return viewStatsFromRpc(Array.isArray(data) ? data[0] : data);
}

const MAX_WINDOW_ROWS = 20_000;

/**
 * Certificate views during a show, per work. Each work is a group of
 * certificate ids (the artist's COA and the show's COS), combined so the
 * same browser viewing both counts as one person.
 */
export async function loadWorkViewStatsInWindow(
  groups: Map<string, string[]>,
  windowFor: (workId: string) => ScanWindow,
): Promise<Map<string, ViewStats>> {
  const out = new Map<string, ViewStats>();
  const certToWork = new Map<string, string>();
  for (const [workId, certs] of groups) for (const c of certs) certToWork.set(c, workId);
  const ids = [...certToWork.keys()];
  if (ids.length === 0) return out;

  const admin = asUntyped(getSupabaseServerAdminClient());
  const rowsByWork = new Map<string, Array<{ visitor: string | null; viewed_at: string }>>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin
      .from('certificate_views')
      .select('artwork_id, visitor, viewed_at')
      .in('artwork_id', ids.slice(i, i + 200))
      .eq('by_owner', false)
      .order('viewed_at', { ascending: false })
      .limit(MAX_WINDOW_ROWS);
    if (error) {
      console.error('[Views] certificate_views fetch failed', { error });
      continue;
    }
    for (const row of (data ?? []) as Array<{ artwork_id: string; visitor: string | null; viewed_at: string }>) {
      const workId = certToWork.get(row.artwork_id);
      if (!workId || !inScanWindow(row.viewed_at, windowFor(workId))) continue;
      const list = rowsByWork.get(workId) ?? [];
      list.push(row);
      rowsByWork.set(workId, list);
    }
  }
  for (const workId of groups.keys()) {
    out.set(workId, computeViewStats(rowsByWork.get(workId) ?? []));
  }
  return out;
}
