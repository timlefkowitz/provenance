import { cookies } from 'next/headers';
import { USER_ROLES, isValidRole, type UserRole } from '~/lib/user-roles';

export const PERSPECTIVE_COOKIE = 'user_perspective';

/**
 * Read the user's active perspective (mode) from the cookie that mirrors the
 * `user_perspective` localStorage value written by the PerspectiveSwitcher.
 *
 * Used on the server where we need to scope queries (for example, list only
 * the exhibitions that belong to the current mode) before the client hydrates.
 *
 * Returns `null` when no valid perspective has been set so callers can decide
 * whether to fall back to a different default (e.g., the DB account role).
 */
export async function readPerspective(): Promise<UserRole | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PERSPECTIVE_COOKIE)?.value;
  if (!raw) return null;
  return isValidRole(raw) ? (raw as UserRole) : null;
}

/** Narrow a perspective to the owner-role subset used by exhibitions. */
export function perspectiveToOwnerRole(
  perspective: UserRole | null,
): 'gallery' | 'institution' | null {
  if (perspective === USER_ROLES.GALLERY) return 'gallery';
  if (perspective === USER_ROLES.INSTITUTION) return 'institution';
  return null;
}
