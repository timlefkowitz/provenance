import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import pathsConfig from '~/config/paths.config';
import {
  canEditInstitutionSetup,
  institutionSetupPath,
  type InstitutionTeamViewerRole,
} from '~/lib/institutions/institution-setup';
import { asUntyped } from '~/lib/supabase-untyped';
import { USER_ROLES } from '~/lib/user-roles';

import { getUserProfileById } from '../../_actions/get-user-profiles';
import { InstitutionSetupForm } from './_components/institution-setup-form';

export const metadata = {
  title: 'Institution setup | Provenance',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function InstitutionSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { id } = await params;
  const { welcome } = await searchParams;

  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    redirect(`${pathsConfig.auth.signIn}?next=${encodeURIComponent(institutionSetupPath(id))}`);
  }

  const profile = await getUserProfileById(id);
  if (!profile || profile.role !== USER_ROLES.INSTITUTION) {
    redirect('/profiles');
  }

  let viewerRole: InstitutionTeamViewerRole | null = profile.user_id === user.id ? 'owner' : null;
  if (!viewerRole) {
    const { data: member } = await client
      .from('gallery_members')
      .select('role')
      .eq('gallery_profile_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    viewerRole = (member?.role as InstitutionTeamViewerRole | undefined) ?? null;
  }
  if (!viewerRole) {
    redirect('/profiles');
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 font-serif sm:py-14">
      <InstitutionSetupForm
        profileId={profile.id}
        institutionName={profile.name}
        isWelcome={welcome === '1'}
        canEdit={canEditInstitutionSetup(viewerRole)}
        setupDone={Boolean(profile.setup_completed_at)}
        continueHref="/exhibitions"
        initial={{
          statement: profile.bio ?? '',
          pictureUrl: profile.picture_url ?? '',
          headerImageUrl: profile.header_image_url ?? '',
          isPrivate: profile.is_private === true,
          artworksPrivateByDefault: profile.artworks_private_by_default === true,
        }}
      />
    </div>
  );
}
