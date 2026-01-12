import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function OnboardingGuard({ children }: { children: React.ReactNode }) {
  try {
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') || '';

    // Skip check on onboarding page, auth pages, public pages, or pages with server actions
    // Server actions will fail if we redirect, so we allow access to these pages
    if (
      pathname.startsWith('/onboarding') || 
      pathname.startsWith('/auth') ||
      pathname.startsWith('/about') || // Public about page
      pathname.startsWith('/artworks/add') // Allow artwork uploads even without role
    ) {
      return <>{children}</>;
    }

    const client = getSupabaseServerClient();

    // Use getClaims() instead of getSession() to avoid "Auth session missing!" errors
    // This is the same approach used in middleware and other server components
    const { data: claimsData, error: claimsError } = await client.auth
      .getClaims()
      .catch((error) => {
        console.error('Auth getClaims error in OnboardingGuard:', error);
        return { data: null, error };
      });

    if (claimsError || !claimsData?.claims) {
      return <>{children}</>;
    }

    // Extract user ID from claims
    const userId = claimsData.claims.sub;

    if (userId) {
      const { data: account, error: accountError } = await client
        .from('accounts')
        .select('public_data')
        .eq('id', userId)
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
  } catch (error: any) {
    // Re-throw redirect errors - they're expected and handled by Next.js
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    
    // If there's any other error (e.g., Supabase connection failure), allow access
    // This prevents the entire app from breaking due to configuration issues
    console.error('Error in OnboardingGuard:', error);
    return <>{children}</>;
  }

  return <>{children}</>;
}

