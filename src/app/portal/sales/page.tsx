import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { EntityStatsDashboard } from '~/app/_components/entity-stats-dashboard';
import { getUserRole, isValidRole, USER_ROLES, type UserRole } from '~/lib/user-roles';

export const metadata = {
  title: 'Sales | Provenance',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PortalSalesPage() {
  console.log('[Portal/Sales] rendering');

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const { data: account } = await client
    .from('accounts')
    .select('id, name, public_data')
    .eq('id', user.id)
    .single();

  const resolvedRole: UserRole = (() => {
    const fromAccount = getUserRole(account?.public_data as Record<string, any> | null);
    if (fromAccount) return fromAccount;
    return USER_ROLES.COLLECTOR;
  })();

  const effectiveRole: UserRole = isValidRole(resolvedRole)
    ? resolvedRole
    : USER_ROLES.COLLECTOR;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink/50 font-serif">
            Portal
          </p>
          <h1 className="text-3xl font-serif text-ink">Sales dashboard</h1>
          <p className="text-sm font-serif text-ink/60 mt-1">
            Who you sold to, aggregated stats, and exhibition reach.
          </p>
        </div>
        <Link
          href="/portal"
          className="font-serif text-sm underline underline-offset-4 text-wine"
        >
          Back to portal
        </Link>
      </header>

      <EntityStatsDashboard
        accountId={user.id}
        role={effectiveRole}
        includeSales
      />
    </div>
  );
}
