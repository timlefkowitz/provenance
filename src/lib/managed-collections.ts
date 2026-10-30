import { USER_ROLES } from '~/lib/user-roles';

type ProfileLike = {
  user_id?: unknown;
  role?: unknown;
  is_claimed?: unknown;
  is_active?: unknown;
} | null | undefined;

/**
 * True when `profile` is a managed collection (collector profile, not yet handed off)
 * that `userId` is building on someone else's behalf.
 */
export function isManagedCollectionOf(profile: ProfileLike, userId: string): boolean {
  if (!profile || !userId) return false;
  return (
    profile.role === USER_ROLES.COLLECTOR &&
    profile.is_claimed === false &&
    profile.is_active !== false &&
    profile.user_id === userId
  );
}

/** Owner name to print on a certificate posted into a collector profile. */
export function collectionOwnerName(profile: { name?: string | null; managed_for_name?: string | null } | null | undefined): string | null {
  const name = profile?.managed_for_name?.trim() || profile?.name?.trim();
  return name || null;
}
