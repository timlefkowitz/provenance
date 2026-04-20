import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, getRoleLabel, USER_ROLES, type UserRole } from '~/lib/user-roles';
import { ExhibitionForm } from '../_components/exhibition-form';

export const metadata = {
  title: 'New Exhibition | Provenance',
};

export default async function NewExhibitionPage() {
  const client = getSupabaseServerClient();
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

  const userRole = getUserRole(account.public_data as Record<string, any>);
  const allowedRoles = new Set<UserRole>([USER_ROLES.GALLERY, USER_ROLES.INSTITUTION]);
  if (!userRole || !allowedRoles.has(userRole)) {
    console.warn('[Exhibitions] NewExhibitionPage access denied', { userRole });
    redirect('/registry');
  }

  const modeLabel = getRoleLabel(userRole);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          New Exhibition
        </h1>
        <p className="text-ink/70 font-serif">
          Create a new exhibition for your {modeLabel.toLowerCase()}
        </p>
      </div>

      <ExhibitionForm />
    </div>
  );
}

