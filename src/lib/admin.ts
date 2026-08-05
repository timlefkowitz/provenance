import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { User } from '@supabase/supabase-js';

import { asUntyped } from '~/lib/supabase-untyped';

type AdminAccountState = {
  isAdminFlag: boolean;
  /**
   * MFA enrollment grace-period deadline (see migration
   * 20260714000000_admin_mfa_grace_period.sql). Null if the account isn't
   * admin, or if the deadline column hasn't been populated for some reason
   * (treated as "already expired" — fail closed rather than grandfathering
   * indefinitely).
   */
  mfaGraceDeadline: Date | null;
};

/**
 * Fetch admin status and MFA grace-period deadline in a single query.
 * Internal helper for the require* functions below — `isAdmin()` stays the
 * public, MFA-agnostic check for callers (e.g. /api/admin/check) that only
 * care about the flag.
 */
async function getAdminAccountState(userId: string): Promise<AdminAccountState> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: account } = await client
    .from('accounts')
    .select('public_data, admin_mfa_grace_deadline')
    .eq('id', userId)
    .single();

  if (!account?.public_data) {
    return { isAdminFlag: false, mfaGraceDeadline: null };
  }

  const publicData = account.public_data as Record<string, unknown>;
  const isAdminFlag = publicData.admin === true;
  const rawDeadline = (account as { admin_mfa_grace_deadline?: string | null })
    .admin_mfa_grace_deadline;

  return {
    isAdminFlag,
    mfaGraceDeadline: isAdminFlag && rawDeadline ? new Date(rawDeadline) : null,
  };
}

/**
 * Check if a user is an admin
 * Uses public_data.admin field in accounts table (no database changes needed)
 */
export async function isAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) {
    return false;
  }

  try {
    const client = asUntyped(getSupabaseServerClient());
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
    const client = asUntyped(getSupabaseServerClient());
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
 * Whole days remaining until `deadline`, or null if there is no deadline.
 * Kept as a plain (non-component) helper — components should call this
 * rather than invoking `Date.now()` directly in their render body, which
 * trips the react-hooks/purity lint rule (components must be idempotent).
 */
export function daysUntil(deadline: Date | null | undefined): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

type MfaOutcome =
  | { kind: 'ok'; requiresMfaSetup: boolean; mfaGraceDeadline: Date | null }
  | { kind: 'step_up_required' }
  | { kind: 'grace_expired' };

/**
 * Shared MFA assurance check used by every require* variant below.
 *
 * - Factors enrolled (nextLevel === 'aal2') and session already stepped up
 *   (currentLevel === 'aal2') → 'ok', no grace period involved at all.
 * - Factors enrolled, session not stepped up yet → 'step_up_required'.
 * - No factors enrolled, still inside the 7-day grace period from
 *   admin_mfa_grace_deadline → 'ok' with requiresMfaSetup=true (banner nudge).
 * - No factors enrolled, grace period expired (or was never set — fail
 *   closed) → 'grace_expired' (CASA 3.3: admin interfaces must use MFA).
 *
 * Any error checking AAL fails closed as 'step_up_required'.
 */
async function evaluateAdminMfa(state: AdminAccountState): Promise<MfaOutcome> {
  const client = asUntyped(getSupabaseServerClient());

  try {
    const { data: aalData } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    const { currentLevel, nextLevel } = aalData ?? {};

    if (nextLevel === 'aal2') {
      if (currentLevel !== 'aal2') {
        return { kind: 'step_up_required' };
      }

      // Factors enrolled and this session has already completed the MFA
      // challenge — fully satisfied, regardless of the grace-period clock.
      return { kind: 'ok', requiresMfaSetup: false, mfaGraceDeadline: null };
    }

    // No factors enrolled.
    const deadline = state.mfaGraceDeadline;
    const withinGrace = deadline !== null && deadline.getTime() > Date.now();

    if (!withinGrace) {
      return { kind: 'grace_expired' };
    }

    return { kind: 'ok', requiresMfaSetup: true, mfaGraceDeadline: deadline };
  } catch (err) {
    console.error('[Admin] evaluateAdminMfa error — failing closed, requiring step-up', err);
    return { kind: 'step_up_required' };
  }
}

/**
 * Require an authenticated admin user for the current request.
 * Redirects to sign-in if not authenticated, or to home if not admin.
 * If MFA is enrolled but not yet verified this session, redirects to /auth/verify.
 * If no MFA is enrolled and the 7-day grace period has expired, redirects to
 * /settings#security with a message forcing enrollment before continuing.
 * Use at the top of admin page server components.
 *
 * Returns { user, requiresMfaSetup, mfaGraceDeadline } — pass requiresMfaSetup
 * (and mfaGraceDeadline, if set) to the page to render the AdminMfaSetupBanner.
 */
export async function requireAdmin(): Promise<{
  user: User;
  requiresMfaSetup: boolean;
  mfaGraceDeadline: Date | null;
}> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const state = await getAdminAccountState(user.id);
  if (!state.isAdminFlag) {
    redirect('/');
  }

  const outcome = await evaluateAdminMfa(state);

  if (outcome.kind === 'step_up_required') {
    console.log('[Admin] session is aal1 but aal2 factors enrolled — redirecting to /auth/verify');
    redirect('/auth/verify');
  }

  if (outcome.kind === 'grace_expired') {
    console.log('[Admin] MFA grace period expired with no factors enrolled — forcing enrollment', {
      userId: user.id,
    });
    redirect('/settings?require_mfa=1#security');
  }

  return { user, requiresMfaSetup: outcome.requiresMfaSetup, mfaGraceDeadline: outcome.mfaGraceDeadline };
}

/**
 * For API routes: require a signed-in admin or return a JSON error response.
 * Returns 403 when the admin session requires MFA step-up, or when no MFA is
 * enrolled and the grace period has expired.
 */
export async function requireAdminApi(): Promise<
  { user: User; requiresMfaSetup: boolean; mfaGraceDeadline: Date | null } | NextResponse
> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = await getAdminAccountState(user.id);
  if (!state.isAdminFlag) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const outcome = await evaluateAdminMfa(state);

  if (outcome.kind === 'step_up_required') {
    console.log('[Admin] API route blocked — aal2 required but session is aal1');
    return NextResponse.json(
      { error: 'MFA verification required. Please complete step-up authentication.' },
      { status: 403 },
    );
  }

  if (outcome.kind === 'grace_expired') {
    console.log('[Admin] API route blocked — MFA grace period expired with no factors enrolled');
    return NextResponse.json(
      { error: 'MFA enrollment required. Enable two-factor authentication in Settings to continue.' },
      { status: 403 },
    );
  }

  return { user, requiresMfaSetup: outcome.requiresMfaSetup, mfaGraceDeadline: outcome.mfaGraceDeadline };
}

/**
 * Shared helper for server actions: require a signed-in admin and enforce MFA.
 * Throws an Error('Unauthorized') if not authenticated or not admin.
 * Throws an Error('MFA step-up required') if aal2 is enrolled but session is aal1.
 * Throws an Error('MFA enrollment required') if no MFA is enrolled and the
 * grace period has expired.
 *
 * Use this in place of the local requireAdminUser() helpers in server action files.
 */
export async function requireAdminUser(): Promise<{
  user: User;
  requiresMfaSetup: boolean;
  mfaGraceDeadline: Date | null;
}> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const state = await getAdminAccountState(user.id);
  if (!state.isAdminFlag) {
    throw new Error('Unauthorized');
  }

  const outcome = await evaluateAdminMfa(state);

  if (outcome.kind === 'step_up_required') {
    throw new Error('MFA step-up required');
  }

  if (outcome.kind === 'grace_expired') {
    throw new Error('MFA enrollment required');
  }

  return { user, requiresMfaSetup: outcome.requiresMfaSetup, mfaGraceDeadline: outcome.mfaGraceDeadline };
}

/**
 * Shared helper for server actions: require a signed-in admin and return their userId.
 * Returns null if not authenticated, not admin, MFA step-up is pending, or the
 * MFA enrollment grace period has expired.
 */
export async function requireAdminUserId(): Promise<string | null> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) return null;

  const state = await getAdminAccountState(user.id);
  if (!state.isAdminFlag) return null;

  const outcome = await evaluateAdminMfa(state);

  if (outcome.kind === 'step_up_required') {
    console.log('[Admin] requireAdminUserId blocked — aal2 enrolled but session is aal1');
    return null;
  }

  if (outcome.kind === 'grace_expired') {
    console.log('[Admin] requireAdminUserId blocked — MFA grace period expired with no factors enrolled');
    return null;
  }

  return user.id;
}
