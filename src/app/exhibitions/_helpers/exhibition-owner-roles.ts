import { USER_ROLES, type UserRole } from '~/lib/user-roles';

export type ExhibitionOwnerRole = 'artist' | 'collector' | 'gallery' | 'institution';

const SWITCHABLE_OWNER_ROLES: readonly ExhibitionOwnerRole[] = [
  USER_ROLES.GALLERY,
  USER_ROLES.ARTIST,
];

/**
 * Modes an account may create exhibitions under, in display order. Gallery and
 * artist are always offered so the same account can run a gallery show and a
 * separate artist-led show; the current mode is included if it is neither.
 * A locked institution account only ever owns exhibitions as the institution.
 */
export function getExhibitionOwnerRoleOptions(
  currentRole: UserRole | null,
  institutionLocked = false,
): ExhibitionOwnerRole[] {
  if (institutionLocked) return [USER_ROLES.INSTITUTION];
  const options = [...SWITCHABLE_OWNER_ROLES];
  if (currentRole && !options.includes(currentRole)) {
    options.push(currentRole);
  }
  return options;
}

export function canOwnExhibitionAs(
  requested: string | null | undefined,
  currentRole: UserRole | null,
  institutionLocked = false,
): requested is ExhibitionOwnerRole {
  if (!requested) return false;
  return (getExhibitionOwnerRoleOptions(currentRole, institutionLocked) as string[]).includes(
    requested,
  );
}

/** Default owner mode for a new exhibition: the current mode when it can own one. */
export function defaultExhibitionOwnerRole(
  currentRole: UserRole | null,
  requested?: string | null,
  institutionLocked = false,
): ExhibitionOwnerRole {
  if (institutionLocked) return USER_ROLES.INSTITUTION;
  if (canOwnExhibitionAs(requested, currentRole)) return requested;
  if (canOwnExhibitionAs(currentRole, currentRole)) return currentRole;
  return USER_ROLES.GALLERY;
}

/** Whether invited artists' submissions should also produce a linked Certificate of Show. */
export function ownerReceivesCertificateOfShow(ownerRole: string | null | undefined): boolean {
  return ownerRole !== USER_ROLES.ARTIST && ownerRole !== USER_ROLES.COLLECTOR;
}
