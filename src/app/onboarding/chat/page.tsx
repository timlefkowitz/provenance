import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { redirect } from 'next/navigation';

import { TacoOnboardingChat } from '../_components/taco-onboarding-chat';

import { asUntyped } from '~/lib/supabase-untyped';
export const metadata = {
  title: 'Meet Taco — Provenance Onboarding',
};

export default async function OnboardingChatPage() {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Verify the user has already selected the artist role before reaching this step
  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  const role = (account?.public_data as Record<string, unknown> | null)?.role;

  // Non-artists and users without a role shouldn't be here
  if (!role) {
    redirect('/onboarding');
  }

  if (role !== 'artist') {
    redirect('/artworks/add?first_run=1');
  }

  return <TacoOnboardingChat />;
}
