import { ALL_USER_ROLES, USER_ROLES, type UserRole } from '~/lib/user-roles';

/**
 * Locked institution accounts.
 *
 * An admin marks an account with `accounts.public_data.account_type = 'institution'`
 * (see `setInstitutionAccount`). The database keeps users from changing it
 * (`kit.protect_institution_account_lock`), keeps the account in institution mode,
 * and only lets it own institution profiles. Staff on an institution team keep
 * their own, unlocked accounts.
 */
export const INSTITUTION_ACCOUNT_TYPE = 'institution';

export const INSTITUTION_LOCK_MESSAGE =
  'This is an institution account. It can only post as the institution.';

export function isInstitutionAccount(
  publicData: Record<string, unknown> | null | undefined,
): boolean {
  return publicData?.account_type === INSTITUTION_ACCOUNT_TYPE;
}

/** Modes (and profile roles) this account may use. */
export function getAllowedRolesForAccount(
  publicData: Record<string, unknown> | null | undefined,
): UserRole[] {
  return isInstitutionAccount(publicData) ? [USER_ROLES.INSTITUTION] : [...ALL_USER_ROLES];
}

export function canAccountActAs(
  publicData: Record<string, unknown> | null | undefined,
  role: string | null | undefined,
): boolean {
  if (!isInstitutionAccount(publicData)) return true;
  return role === USER_ROLES.INSTITUTION;
}
