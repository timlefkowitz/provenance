import type { UserProfile } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES, type UserRole } from '~/lib/user-roles';

/**
 * Display names per UI mode (artist, gallery, etc.) for badges like "Creating as".
 * Prefers active profile name; falls back to account name, then email local-part.
 */
export function buildModeEntityDisplayNames(
  profiles: UserProfile[],
  accountName: string | null | undefined,
  email: string | null | undefined,
): Record<UserRole, string | null> {
  const trimmedAccount =
    typeof accountName === 'string' && accountName.trim().length > 0
      ? accountName.trim()
      : null;
  const emailLocal =
    email && email.includes('@')
      ? email.split('@')[0]?.trim() || null
      : null;
  const genericFallback = trimmedAccount || emailLocal;

  const forRole = (role: UserRole): string | null => {
    const rawName = profiles.find((p) => p.role === role && p.is_active)?.name;
    const trimmedProfile =
      typeof rawName === 'string' && rawName.trim().length > 0
        ? rawName.trim()
        : null;
    if (trimmedProfile) return trimmedProfile;
    return genericFallback;
  };

  return {
    [USER_ROLES.ARTIST]: forRole(USER_ROLES.ARTIST),
    [USER_ROLES.COLLECTOR]: forRole(USER_ROLES.COLLECTOR),
    [USER_ROLES.GALLERY]: forRole(USER_ROLES.GALLERY),
    [USER_ROLES.INSTITUTION]: forRole(USER_ROLES.INSTITUTION),
  };
}
