import type { UserProfile } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES, type UserRole } from '~/lib/user-roles';

/**
 * Display names per UI mode (artist, gallery, etc.) for badges like "Creating as".
 * Prefers active profile name; falls back to team gallery profile name, then
 * account name, then email local-part.
 *
 * @param teamGalleryProfiles - Gallery profiles the user can act as via team
 *   membership (from getUserGalleryProfiles). Used as a fallback when the
 *   user has no owned gallery user_profile of their own.
 */
export function buildModeEntityDisplayNames(
  profiles: UserProfile[],
  accountName: string | null | undefined,
  email: string | null | undefined,
  teamGalleryProfiles: Pick<UserProfile, 'name' | 'role' | 'is_active' | 'user_id'>[] = [],
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
    // Prefer an owned active profile for this role
    const rawName = profiles.find((p) => p.role === role && p.is_active)?.name;
    const trimmedProfile =
      typeof rawName === 'string' && rawName.trim().length > 0
        ? rawName.trim()
        : null;
    if (trimmedProfile) return trimmedProfile;

    // For gallery mode: fall back to the first team gallery profile name
    if (role === USER_ROLES.GALLERY) {
      const teamName = teamGalleryProfiles.find((p) => p.role === USER_ROLES.GALLERY)?.name;
      const trimmedTeam =
        typeof teamName === 'string' && teamName.trim().length > 0
          ? teamName.trim()
          : null;
      if (trimmedTeam) return trimmedTeam;
    }

    return genericFallback;
  };

  return {
    [USER_ROLES.ARTIST]: forRole(USER_ROLES.ARTIST),
    [USER_ROLES.COLLECTOR]: forRole(USER_ROLES.COLLECTOR),
    [USER_ROLES.GALLERY]: forRole(USER_ROLES.GALLERY),
    [USER_ROLES.INSTITUTION]: forRole(USER_ROLES.INSTITUTION),
  };
}
