import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole } from '~/lib/user-roles';
import { ExhibitionForm } from '../_components/exhibition-form';
import {
  defaultExhibitionOwnerRole,
  getExhibitionOwnerRoleOptions,
} from '../_helpers/exhibition-owner-roles';
import { isInstitutionAccount } from '~/lib/institution-account';
import { listVenueGalleriesForUser } from '~/lib/exhibitions/exhibition-venue';
import { parseShowType } from '../_helpers/show-collaboration';

import { asUntyped } from '~/lib/supabase-untyped';
import { EditorialPageHeader } from '~/components/editorial-form';
export const metadata = {
  title: 'New Exhibition | Provenance',
};

export default async function NewExhibitionPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; type?: string }>;
}) {
  const { as: requestedOwnerRole, type: requestedShowType } = await searchParams;
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    redirect('/registry');
  }

  const userRole = getUserRole(account.public_data as Record<string, unknown>);
  const institutionLocked = isInstitutionAccount(account.public_data as Record<string, unknown>);
  const venues = await listVenueGalleriesForUser(client, user.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <EditorialPageHeader
        eyebrow="Exhibitions"
        title="New exhibition"
        description="Set a date and invite artists: one for a solo show, several for a group show, or open it to everyone"
      />

      <ExhibitionForm
        ownerRoleOptions={getExhibitionOwnerRoleOptions(userRole, institutionLocked)}
        defaultOwnerRole={defaultExhibitionOwnerRole(userRole, requestedOwnerRole, institutionLocked)}
        venueOptions={venues.map(({ id, name }) => ({ id, name }))}
        defaultShowType={parseShowType(requestedShowType)}
      />
    </div>
  );
}
