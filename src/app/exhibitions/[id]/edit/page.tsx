import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { getExhibitionWithDetails } from '../../_actions/get-exhibitions';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { ExhibitionForm } from '../../_components/exhibition-form';
import { ExhibitionDetails } from '../../_components/exhibition-details';
import { ExhibitionInvitesPanel } from '../../_components/exhibition-invites-panel';
import {
  getExhibitionInvites,
  getUninvitedCreditedArtists,
} from '../../_actions/manage-exhibition-invites';
import { getExhibitionOpenCall } from '../../_actions/exhibition-open-call';
import { ExhibitionOpenCallPanel } from '../../_components/exhibition-open-call-panel';
import { getExhibitionSubmissions } from '../../_actions/review-exhibition-submissions';
import { ExhibitionSubmissionsPanel } from '../../_components/exhibition-submissions-panel';
import { ownerReceivesCertificateOfShow } from '../../_helpers/exhibition-owner-roles';

import { asUntyped } from '~/lib/supabase-untyped';
import { EditorialPageHeader, Eyebrow } from '~/components/editorial-form';
export const metadata = {
  title: 'Edit Exhibition | Provenance',
};

export default async function EditExhibitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Verify user is a gallery
  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    redirect('/registry');
  }

  const userRole = getUserRole(account.public_data as Record<string, unknown>);
  const allowedRoles = new Set([
    USER_ROLES.GALLERY,
    USER_ROLES.INSTITUTION,
    USER_ROLES.ARTIST,
    USER_ROLES.COLLECTOR,
  ]);
  if (!userRole || !allowedRoles.has(userRole)) {
    redirect('/registry');
  }

  // Get exhibition with details
  const exhibition = await getExhibitionWithDetails(id, { viewerUserId: user.id });

  if (!exhibition || !(await canManageExhibition(user.id, exhibition.gallery_id))) {
    redirect('/exhibitions');
  }

  const [invites, uninvitedArtists, openCall, submissions] = await Promise.all([
    getExhibitionInvites(id),
    getUninvitedCreditedArtists(id),
    getExhibitionOpenCall(id),
    getExhibitionSubmissions(id),
  ]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <EditorialPageHeader eyebrow="Exhibitions" title="Edit exhibition" description="Update exhibition details" />

      <ExhibitionForm exhibition={exhibition} />

      <ExhibitionOpenCallPanel
        exhibitionId={id}
        openCall={openCall}
        defaultClosingDate={exhibition.start_date?.slice(0, 10) ?? null}
      />

      <ExhibitionInvitesPanel
        exhibitionId={id}
        initialInvites={invites}
        uninvitedArtists={uninvitedArtists}
      />

      <ExhibitionSubmissionsPanel
        exhibitionId={id}
        initialGroups={submissions}
        issuesCertificateOfShow={ownerReceivesCertificateOfShow(exhibition.owner_role)}
      />

      <section id="artworks" className="mt-16 pt-10 border-t border-editorial-border/30 scroll-mt-8">
        <div className="mb-8">
          <Eyebrow className="mb-3">Draft listings</Eyebrow>
          <h2 className="font-fraunces text-2xl italic tracking-tight text-editorial-ink">
            Artworks in this exhibition
          </h2>
          <p className="text-editorial-ink/55 font-serif text-sm mt-2 max-w-2xl">
            Search and add quick listings here. Drafts stay visible only to you until you publish each work.
          </p>
        </div>
        <ExhibitionDetails exhibition={exhibition} isOwner />
      </section>
    </div>
  );
}

