import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import {
  canManageExhibition,
  isGalleryMember,
} from '~/app/profiles/_actions/gallery-members';
import { cosApprovingArtistId, shouldIssueExhibitionCos } from '~/lib/certificate-claims/cos-approval';
import type { CuratorWork } from '../[id]/curate/_components/curator-works-list';
import { isShownInExhibition } from './exhibition-submission-status';
import { ownerReceivesCertificateOfShow } from './exhibition-owner-roles';

export type CuratorShow = {
  exhibition: {
    id: string;
    title: string;
    gallery_id: string;
    owner_role: string | null;
    published_at: string | null;
  };
  works: CuratorWork[];
  awaitingCosCount: number;
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
    .select('id, title, gallery_id, owner_role, published_at')
    .eq('id', exhibitionId)
    .maybeSingle();

  if (!exhibition) return null;
  if (!(await canManageExhibition(userId, exhibition.gallery_id as string))) return null;

  const { data: links } = await admin
    .from('exhibition_artworks')
    .select('artwork_id, status, cos_artwork_id, created_at')
    .eq('exhibition_id', exhibitionId);

  type Link = { artwork_id: string; status: unknown; cos_artwork_id: string | null };
  // An artist's COA with a Certificate of Show in this show is listed once:
  // shown as the COA, while selling and edits go through the curator's COS.
  const folded = ((links ?? []) as Link[]).filter(
    (l) => isShownInExhibition(l.status) && l.cos_artwork_id && l.cos_artwork_id !== l.artwork_id,
  );
  const coveredByCos = new Set(folded.map((l) => l.artwork_id));
  const coaOfCos = new Map(folded.map((l) => [l.cos_artwork_id as string, l.artwork_id]));
  const shown = ((links ?? []) as Link[]).filter(
    (l) => isShownInExhibition(l.status) && !coveredByCos.has(l.artwork_id),
  );
  const order = new Map<string, number>(shown.map((l, i) => [l.artwork_id, i]));
  const artworkIds = shown.map((l) => l.artwork_id);

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

  const holderIds = Array.from(
    new Set(
      visible.flatMap((a) => [a.account_id as string, (a.artist_account_id as string | null) ?? '']),
    ),
  ).filter(Boolean);
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

  const showIssuesCos = ownerReceivesCertificateOfShow(exhibition.owner_role as string | null);

  const works: CuratorWork[] = [];
  for (const a of visible) {
    const editable = await canEdit(a);
    const approvingArtist = editable
      ? cosApprovingArtistId({
          account_id: (a.account_id as string | null) ?? null,
          certificate_type: (a.certificate_type as string | null) ?? null,
          artist_account_id: (a.artist_account_id as string | null) ?? null,
        })
      : null;
    const needsApproval = Boolean(approvingArtist && approvingArtist !== userId);
    works.push({
      artwork: a as unknown as CuratorWork['artwork'],
      coaId: coaOfCos.get(a.id as string) ?? null,
      certificateType: (a.certificate_type as string | null) ?? null,
      isDraft: a.status === 'draft',
      holderName: holderName.get(a.account_id as string) || null,
      editable,
      editHref:
        editable && !needsApproval
          ? a.account_id === userId
            ? `/artworks/${a.id}/edit`
            : `/artworks/${a.id}/certificate`
          : null,
      approverName: needsApproval
        ? holderName.get(approvingArtist as string) || (a.artist_name as string | null) || 'the artist'
        : null,
      changePending: pendingIds.has(a.id as string),
      sold: a.is_sold
        ? {
            to:
              (a.sold_to_name as string | null) ||
              (editable ? (a.sold_to_email as string | null) : null) ||
              null,
          }
        : null,
      awaitsCos:
        showIssuesCos &&
        !editable &&
        shouldIssueExhibitionCos({
          ownerRole: exhibition.owner_role as string | null,
          ownerAccountId: exhibition.gallery_id as string,
          certificateType: (a.certificate_type as string | null) ?? null,
          holderAccountId: (a.account_id as string | null) ?? null,
        }),
    });
  }

  return {
    exhibition: exhibition as CuratorShow['exhibition'],
    works,
    awaitingCosCount: works.filter((w) => w.awaitsCos).length,
  };
}
