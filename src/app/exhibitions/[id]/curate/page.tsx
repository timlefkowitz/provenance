import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import {
  canManageExhibition,
  isGalleryMember,
} from '~/app/profiles/_actions/gallery-members';
import { isShownInExhibition } from '../../_helpers/exhibition-submission-status';
import { CuratorWorksList, type CuratorWork } from './_components/curator-works-list';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Curator view | Provenance',
};

/**
 * Every work in the show in one place, whoever holds its certificate. The
 * gallery edits its own Certificates of Show directly; for a certificate held
 * by someone else (an artist's COA) the curator suggests changes, which the
 * holder accepts or declines from their portal.
 */
export default async function CurateExhibitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) redirect(`/auth/sign-in?next=/exhibitions/${id}/curate`);

  const { data: exhibition } = await client
    .from('exhibitions')
    .select('id, title, gallery_id, published_at')
    .eq('id', id)
    .maybeSingle();

  if (!exhibition) notFound();
  if (!(await canManageExhibition(user.id, exhibition.gallery_id as string))) notFound();

  // Access is settled above; the service role reads works whose certificates
  // other people hold (artists' COAs aren't visible to the gallery via RLS).
  const admin = asUntyped(getSupabaseServerAdminClient());

  const { data: links } = await admin
    .from('exhibition_artworks')
    .select('artwork_id, status, created_at')
    .eq('exhibition_id', id);

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
        .eq('requested_by', user.id)
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
    if (a.account_id === user.id) return true;
    const profileId = a.gallery_profile_id as string | null;
    if (!profileId) return false;
    if (!memberOf.has(profileId)) memberOf.set(profileId, await isGalleryMember(user.id, profileId));
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
        ? a.account_id === user.id
          ? `/artworks/${a.id}/edit`
          : `/artworks/${a.id}/certificate`
        : null,
      changePending: pendingIds.has(a.id as string),
    });
  }

  const galleryCount = works.filter((w) => w.editHref).length;
  const otherCount = works.length - galleryCount;
  const coaCount = works.filter(
    (w) => !w.editHref && w.certificateType === CERTIFICATE_TYPES.AUTHENTICITY,
  ).length;

  return (
    <div className="min-h-screen">
      <div className="border-b border-wine/15">
        <div className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
          <Link
            href={`/exhibitions/${id}`}
            className="mb-6 inline-flex items-center gap-1.5 font-serif text-xs text-ink/50 hover:text-wine"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to exhibition
          </Link>
          <p className="mb-2 font-serif text-[11px] uppercase tracking-widest text-wine/50">
            Curator view
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">
            {exhibition.title as string}
          </h1>
          <p className="mt-4 max-w-2xl font-serif text-sm leading-relaxed text-ink/60">
            {works.length} work{works.length === 1 ? '' : 's'} in the show: {galleryCount} with
            certificates you can edit, {otherCount} held by{' '}
            {coaCount === otherCount ? 'the artists' : 'artists and others'}. Changes to a certificate
            someone else holds are sent to them to accept or decline.
          </p>
        </div>
      </div>
      <div className="container mx-auto max-w-6xl px-4 py-10 pb-16">
        <CuratorWorksList works={works} exhibitionId={id} />
      </div>
    </div>
  );
}
