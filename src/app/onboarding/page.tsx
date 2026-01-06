import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { redirect } from 'next/navigation';

import { OnboardingForm } from './_components/onboarding-form';

export const metadata = {
  title: 'Onboarding',
};

export default async function OnboardingPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Check if user already has a role
  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  if (account?.public_data && (account.public_data as any).role) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-wine">
            Welcome to Provenance
          </h1>
          <p className="mt-2 text-sm text-stone-600 font-body">
            Select your role to get started.
          </p>
        </div>

        <div className="mt-8 bg-white p-6 shadow-sm ring-1 ring-stone-200 sm:rounded-lg">
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}


