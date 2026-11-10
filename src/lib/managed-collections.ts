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

type ArtistProfileLike = {
  user_id?: unknown;
  role?: unknown;
  is_claimed?: unknown;
  is_active?: unknown;
  created_by_gallery_id?: unknown;
  managed_for_name?: unknown;
} | null | undefined;

/**
 * True when `profile` is an artist profile `userId` manages for an artist who isn't on
 * Provenance yet (an artist manager posting their work). Unlike managed collections,
 * user_id stays null (like other unclaimed artist profiles) so the manager's own artist
 * profile lookups never see it; created_by_gallery_id names the manager.
 */
export function isManagedArtistOf(profile: ArtistProfileLike, userId: string): boolean {
  if (!profile || !userId) return false;
  return (
    profile.role === USER_ROLES.ARTIST &&
    profile.is_claimed === false &&
    profile.is_active !== false &&
    profile.user_id == null &&
    profile.created_by_gallery_id === userId &&
    typeof profile.managed_for_name === 'string' &&
    profile.managed_for_name.trim().length > 0
  );
}

/** True when `userId` may hand `profile` over: a managed collection or managed artist they built. */
export function canHandOffProfile(profile: ArtistProfileLike, userId: string): boolean {
  return isManagedCollectionOf(profile, userId) || isManagedArtistOf(profile, userId);
}
