import { USER_ROLES } from '~/lib/user-roles';

/**
 * Directory-only role fixes for /registry (and /artists redirect).
 * Prefer correcting `accounts.public_data.role` and `user_profiles.role` in Supabase;
 * this list is for known mis-entries that should read as artists in the public list.
 */
const FORCE_ARTIST_NAMES = new Set(['krystal jones', 'quintin warner']);

function normalizeDisplayName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * When a name is in the override set, the registry lists them under Artists and
 * uses artist-style links and artwork count keys.
 */
export function resolveRegistryDirectoryRole(
  displayName: string,
  baseRole: string | null,
): string | null {
  if (FORCE_ARTIST_NAMES.has(normalizeDisplayName(displayName))) {
    return USER_ROLES.ARTIST;
  }
  return baseRole;
}
