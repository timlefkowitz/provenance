import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { User } from '@supabase/supabase-js';

/**
 * Check if a user is an admin
 * Uses public_data.admin field in accounts table (no database changes needed)
 */
export async function isAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) {
    return false;
  }

  try {
    const client = getSupabaseServerClient();
    const { data: account } = await client
      .from('accounts')
      .select('public_data')
      .eq('id', userId)
      .single();

    if (!account?.public_data) {
      return false;
    }

    const publicData = account.public_data as Record<string, unknown>;
    return publicData.admin === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get the current user's admin status
 */
export async function getCurrentUserAdminStatus(): Promise<boolean> {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      return false;
    }

    return await isAdmin(user.id);
  } catch (error) {
    console.error('Error getting current user admin status:', error);
    return false;
  }
}

/**
 * Verify that the current session belongs to an admin and enforce MFA assurance.
 *
 * - If the admin has MFA factors enrolled but the session is aal1 (not yet
 *   step-up verified this session), redirects to /auth/verify.
 * - If the admin has NO factors enrolled yet, allows access but sets
 *   requiresMfaSetup=true so callers can show the MFA setup banner.
 *
 * Returns { user, requiresMfaSetup } on success. Redirects/throws on failure.
 */
async function checkAdminMfa(
  user: User,
): Promise<{ user: User; requiresMfaSetup: boolean }> {
  const client = getSupabaseServerClient();

  try {
    const { data: aalData } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    const { currentLevel, nextLevel } = aalData ?? {};

    // Admin has enrolled factors but this session hasn't stepped up yet → force MFA verify
    if (nextLevel === 'aal2' && currentLevel !== 'aal2') {
      console.log('[Admin] session is aal1 but aal2 factors enrolled — redirecting to /auth/verify');
      redirect('/auth/verify');
    }

    // Admin has no MFA factors enrolled → allow but flag for setup banner
    const requiresMfaSetup = nextLevel !== 'aal2';
    return { user, requiresMfaSetup };
  } catch (err) {
    // redirect() throws internally — rethrow it
    if ((err as Error)?.message?.includes('NEXT_REDIRECT')) {
      throw err;
    }
    console.error('[Admin] checkAdminMfa error, allowing access without AAL check', err);
    // Fail open (allow admin access) rather than locking admins out on a transient error.
    return { user, requiresMfaSetup: false };
  }
}

/**
 * Require an authenticated admin user for the current request.
 * Redirects to sign-in if not authenticated, or to home if not admin.
 * If MFA is enrolled but not yet verified this session, redirects to /auth/verify.
 * Use at the top of admin page server components.
 *
 * Returns { user, requiresMfaSetup } — pass requiresMfaSetup to the page to
 * conditionally render the AdminMfaSetupBanner.
 */
export async function requireAdmin(): Promise<{ user: User; requiresMfaSetup: boolean }> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const userIsAdmin = await isAdmin(user.id);
  if (!userIsAdmin) {
    redirect('/');
  }

  return checkAdminMfa(user);
}

/**
 * For API routes: require a signed-in admin or return a JSON error response.
 * Returns 403 when the admin session requires MFA step-up.
 */
export async function requireAdminApi(): Promise<
  { user: User; requiresMfaSetup: boolean } | NextResponse
> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userIsAdmin = await isAdmin(user.id);
  if (!userIsAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check MFA for API routes: return 403 when step-up is required
  try {
    const { data: aalData } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    const { currentLevel, nextLevel } = aalData ?? {};

    if (nextLevel === 'aal2' && currentLevel !== 'aal2') {
      console.log('[Admin] API route blocked — aal2 required but session is aal1');
      return NextResponse.json(
        { error: 'MFA verification required. Please complete step-up authentication.' },
        { status: 403 },
      );
    }

    const requiresMfaSetup = nextLevel !== 'aal2';
    return { user, requiresMfaSetup };
  } catch (err) {
    console.error('[Admin] requireAdminApi MFA check error', err);
    return { user, requiresMfaSetup: false };
  }
}

/**
 * Shared helper for server actions: require a signed-in admin and enforce MFA.
 * Throws an Error('Unauthorized') if not authenticated or not admin.
 * Throws an Error('MFA step-up required') if aal2 is enrolled but session is aal1.
 *
 * Use this in place of the local requireAdminUser() helpers in server action files.
 */
export async function requireAdminUser(): Promise<{ user: User; requiresMfaSetup: boolean }> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const userIsAdmin = await isAdmin(user.id);
  if (!userIsAdmin) {
    throw new Error('Unauthorized');
  }

  try {
    const { data: aalData } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    const { currentLevel, nextLevel } = aalData ?? {};

    if (nextLevel === 'aal2' && currentLevel !== 'aal2') {
      throw new Error('MFA step-up required');
    }

    const requiresMfaSetup = nextLevel !== 'aal2';
    return { user, requiresMfaSetup };
  } catch (err) {
    if ((err as Error)?.message === 'MFA step-up required') {
      throw err;
    }
    console.error('[Admin] requireAdminUser MFA check error', err);
    return { user, requiresMfaSetup: false };
  }
}

/**
 * Shared helper for server actions: require a signed-in admin and return their userId.
 * Returns null if not authenticated or not admin (caller checks and returns early).
 */
export async function requireAdminUserId(): Promise<string | null> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) return null;

  const userIsAdmin = await isAdmin(user.id);
  if (!userIsAdmin) return null;

  try {
    const { data: aalData } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    const { currentLevel, nextLevel } = aalData ?? {};

    // Block when MFA step-up is enrolled but not yet verified
    if (nextLevel === 'aal2' && currentLevel !== 'aal2') {
      console.log('[Admin] requireAdminUserId blocked — aal2 enrolled but session is aal1');
      return null;
    }
  } catch (err) {
    console.error('[Admin] requireAdminUserId MFA check error', err);
    // Fail open on transient errors
  }

  return user.id;
}
