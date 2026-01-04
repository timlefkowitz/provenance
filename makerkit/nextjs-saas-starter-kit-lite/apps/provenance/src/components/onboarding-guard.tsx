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

  try {
    const client = getSupabaseServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();

    // If there's an auth error (e.g., invalid Supabase config), allow access
    // This prevents the app from breaking if env vars are misconfigured
    if (authError) {
      console.error('Auth error in OnboardingGuard:', authError);
      return <>{children}</>;
    }

    if (user) {
      const { data: account, error: accountError } = await client
        .from('accounts')
        .select('public_data')
        .eq('id', user.id)
        .single();

      // If account query fails, allow access (don't block the app)
      if (accountError) {
        console.error('Account query error in OnboardingGuard:', accountError);
        return <>{children}</>;
      }

      const role = (account?.public_data as any)?.role;

      if (!role) {
        redirect('/onboarding');
      }
    }
  } catch (error) {
    // If there's any error (e.g., Supabase connection failure), allow access
    // This prevents the entire app from breaking due to configuration issues
    console.error('Error in OnboardingGuard:', error);
    return <>{children}</>;
  }

  return <>{children}</>;
}

