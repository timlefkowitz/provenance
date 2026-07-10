import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { asUntyped } from '~/lib/supabase-untyped';
export async function OnboardingGuard({ children }: { children: React.ReactNode }) {
  try {
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') || '';

    // Skip check on onboarding page, auth pages, and fully public pages.
    // Note: /artworks/add is intentionally NOT excluded so new users are
    // funnelled through role selection before creating their first certificate.
    if (
      pathname.startsWith('/onboarding') || 
      pathname.startsWith('/auth') ||
      pathname.startsWith('/about') || // Public about page
      pathname.startsWith('/settings') || // Account/settings page (redirects to sign-in if not authenticated)
      pathname.startsWith('/artists') || // Public artist profiles
      pathname.startsWith('/registry') || // Public directory (includes /artists index redirect target)
      pathname.startsWith('/g/') // Public gallery pages by slug
    ) {
      return <>{children}</>;
    }

    const client = asUntyped(getSupabaseServerClient());

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
  } catch (error) {
    // Re-throw redirect errors - they're expected and handled by Next.js
    if ((error as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    
    // If there's any other error (e.g., Supabase connection failure), allow access
    // This prevents the entire app from breaking due to configuration issues
    console.error('Error in OnboardingGuard:', error);
    return <>{children}</>;
  }

  return <>{children}</>;
}

