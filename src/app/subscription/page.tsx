import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { SubscriptionContent } from './_components/subscription-content';
import { getUserRole, isValidRole } from '~/lib/user-roles';
import type { SubscriptionRole } from '~/lib/stripe-config';

export const metadata = {
  title: 'Subscription | Provenance',
  description: 'Manage your subscription and billing',
};

type SearchParams = Promise<{ success?: string; canceled?: string; upgrade?: string }>;

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const params = await searchParams;
  const success = params.success === '1';
  const canceled = params.canceled === '1';
  const upgrade = params.upgrade === '1';

  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  const accountDefaultRole = getUserRole(
    (account?.public_data as Record<string, unknown> | null) ?? null
  );

  const { data: subscriptionRows } = await (client as any)
    .from('subscriptions')
    .select('id, role, status, current_period_end, trial_end')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .order('current_period_end', { ascending: false })
    .limit(1);

  const subscription = subscriptionRows?.[0] ?? null;

  const defaultRole: SubscriptionRole | null =
    subscription?.status === 'trialing' &&
    subscription.role &&
    isValidRole(subscription.role)
      ? (subscription.role as SubscriptionRole)
      : accountDefaultRole;

  return (
    <div className="container py-10">
      <SubscriptionContent
        subscription={subscription}
        defaultRole={defaultRole}
        success={success}
        canceled={canceled}
        upgrade={upgrade}
      />
    </div>
  );
}
