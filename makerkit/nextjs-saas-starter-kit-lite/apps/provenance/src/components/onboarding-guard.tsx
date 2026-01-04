import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';

  // Skip check on onboarding page or auth pages
  if (pathname.startsWith('/onboarding') || pathname.startsWith('/auth')) {
    return <>{children}</>;
  }

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (user) {
    const { data: account } = await client
      .from('accounts')
      .select('public_data')
      .eq('id', user.id)
      .single();

    const role = (account?.public_data as any)?.role;

    if (!role) {
      redirect('/onboarding');
    }
  }

  return <>{children}</>;
}

