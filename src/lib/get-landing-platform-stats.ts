import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { LandingPlatformStats } from '~/lib/landing-platform-stats.types';
import { USER_ROLES } from '~/lib/user-roles';

export type { LandingPlatformStats } from '~/lib/landing-platform-stats.types';

const empty: LandingPlatformStats = { users: 0, galleries: 0, artworks: 0 };

async function fetchCountsWithAdmin(): Promise<LandingPlatformStats> {
  const admin = getSupabaseServerAdminClient() as any;

  const [usersRes, galleriesRes, artworksRes] = await Promise.all([
    admin.from('accounts').select('*', { count: 'exact', head: true }),
    admin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', USER_ROLES.GALLERY)
      .eq('is_active', true),
    admin.from('artworks').select('*', { count: 'exact', head: true }),
  ]);

  const errors = [usersRes.error, galleriesRes.error, artworksRes.error].filter(Boolean);
  if (errors.length > 0) {
    throw errors[0];
  }

  return {
    users: usersRes.count ?? 0,
    galleries: galleriesRes.count ?? 0,
    artworks: artworksRes.count ?? 0,
  };
}

async function fetchCountsWithServerClient(): Promise<LandingPlatformStats> {
  const client = getSupabaseServerClient() as any;

  const [usersRes, galleriesRes, artworksRes] = await Promise.all([
    client.from('accounts').select('*', { count: 'exact', head: true }),
    client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', USER_ROLES.GALLERY)
      .eq('is_active', true),
    client.from('artworks').select('*', { count: 'exact', head: true }),
  ]);

  const errors = [usersRes.error, galleriesRes.error, artworksRes.error].filter(Boolean);
  if (errors.length > 0) {
    throw errors[0];
  }

  return {
    users: usersRes.count ?? 0,
    galleries: galleriesRes.count ?? 0,
    artworks: artworksRes.count ?? 0,
  };
}

/**
 * Head counts for the public landing page. Prefer service role for accurate global totals.
 */
export async function getLandingPlatformStats(): Promise<LandingPlatformStats> {
  console.log('[Landing] getPlatformStats started');

  try {
    const stats = await fetchCountsWithAdmin();
    console.log('[Landing] getPlatformStats done (admin)', stats);
    return stats;
  } catch (adminErr) {
    console.error('[Landing] platform stats admin fetch failed', adminErr);
    try {
      const stats = await fetchCountsWithServerClient();
      console.log('[Landing] getPlatformStats done (server client fallback)', stats);
      return stats;
    } catch (fallbackErr) {
      console.error('[Landing] platform stats fallback failed', fallbackErr);
      return { ...empty };
    }
  }
}
