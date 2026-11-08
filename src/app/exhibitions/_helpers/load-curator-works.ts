import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import {
  canManageExhibition,
  isGalleryMember,
} from '~/app/profiles/_actions/gallery-members';
import type { CuratorWork } from '../[id]/curate/_components/curator-works-list';
import { isShownInExhibition } from './exhibition-submission-status';

export type CuratorShow = {
  exhibition: { id: string; title: string; gallery_id: string; published_at: string | null };
  works: CuratorWork[];
};

/**
 * Every work selected for a show, whoever holds its certificate, with what the
 * curator may do with each. Returns null when the show doesn't exist or the
 * user can't manage it. Used by the curator view and Collection's curator mode.
 */
export async function loadCuratorWorks(
  userId: string,
  exhibitionId: string,
): Promise<CuratorShow | null> {
  // Access is checked below; the service role reads works whose certificates
  // other people hold (artists' COAs aren't visible to the gallery via RLS).
  const admin = asUntyped(getSupabaseServerAdminClient());

  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('id, title, gallery_id, published_at')
    .eq('id', exhibitionId)
    .maybeSingle();

  if (!exhibition) return null;
  if (!(await canManageExhibition(userId, exhibition.gallery_id as string))) return null;

  const { data: links } = await admin
    .from('exhibition_artworks')
    .select('artwork_id, status, created_at')
    .eq('exhibition_id', exhibitionId);

  const shown = (links ?? []).filter((l: { status: unknown }) => isShownInExhibition(l.status));
  const order = new Map<string, number>(
    shown.map((l: { artwork_id: string }, i: number) => [l.artwork_id, i]),
  );
  const artworkIds = shown.map((l: { artwork_id: string }) => l.artwork_id);

  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < artworkIds.length; i += 200) {
    const { data } = await admin
      .from('artworks')
      .select('*')
      .in('id', artworkIds.slice(i, i + 200));
    rows.push(...((data ?? []) as Record<string, unknown>[]));
  }

  const visible = rows
    .filter((a) => a.status === 'verified' || a.status === 'draft')
    .sort((a, b) => (order.get(a.id as string) ?? 0) - (order.get(b.id as string) ?? 0));

  const holderIds = Array.from(new Set(visible.map((a) => a.account_id as string)));
  const { data: holders } = holderIds.length
    ? await admin.from('accounts').select('id, name').in('id', holderIds)
    : { data: [] };
  const holderName = new Map<string, string>(
    (holders ?? []).map((h: { id: string; name: string | null }) => [h.id, h.name ?? '']),
  );

  const { data: pendingRequests } = artworkIds.length
    ? await admin
        .from('provenance_update_requests')
        .select('artwork_id')
        .eq('requested_by', userId)
        .eq('status', 'pending')
        .eq('request_type', 'provenance_update')
        .in('artwork_id', artworkIds)
    : { data: [] };
  const pendingIds = new Set(
    (pendingRequests ?? []).map((r: { artwork_id: string }) => r.artwork_id),
  );

  // Same rule as the certificate page: the holder, or a team member of the
  // gallery profile the certificate was issued under, edits it directly.
  const memberOf = new Map<string, boolean>();
  const canEdit = async (a: Record<string, unknown>) => {
    if (a.account_id === userId) return true;
    const profileId = a.gallery_profile_id as string | null;
    if (!profileId) return false;
    if (!memberOf.has(profileId)) memberOf.set(profileId, await isGalleryMember(userId, profileId));
    return memberOf.get(profileId) ?? false;
  };

  const works: CuratorWork[] = [];
  for (const a of visible) {
    const editable = await canEdit(a);
    works.push({
      artwork: a as unknown as CuratorWork['artwork'],
      certificateType: (a.certificate_type as string | null) ?? null,
      isDraft: a.status === 'draft',
      holderName: holderName.get(a.account_id as string) || null,
      editHref: editable
        ? a.account_id === userId
          ? `/artworks/${a.id}/edit`
          : `/artworks/${a.id}/certificate`
        : null,
      changePending: pendingIds.has(a.id as string),
    });
  }

  return { exhibition: exhibition as CuratorShow['exhibition'], works };
}
