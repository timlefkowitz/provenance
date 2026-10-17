import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole } from '~/lib/user-roles';
import { ExhibitionForm } from '../_components/exhibition-form';
import {
  defaultExhibitionOwnerRole,
  getExhibitionOwnerRoleOptions,
} from '../_helpers/exhibition-owner-roles';

import { asUntyped } from '~/lib/supabase-untyped';
import { EditorialPageHeader } from '~/components/editorial-form';
export const metadata = {
  title: 'New Exhibition | Provenance',
};

export default async function NewExhibitionPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as: requestedOwnerRole } = await searchParams;
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <EditorialPageHeader
        eyebrow="Exhibitions"
        title="New exhibition"
        description="Create an exhibition and invite artists to upload the work they will show"
      />

      <ExhibitionForm
        ownerRoleOptions={getExhibitionOwnerRoleOptions(userRole)}
        defaultOwnerRole={defaultExhibitionOwnerRole(userRole, requestedOwnerRole)}
      />
    </div>
  );
}
