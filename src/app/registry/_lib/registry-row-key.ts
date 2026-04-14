import { USER_ROLES } from '~/lib/user-roles';

export type RegistryRowLike = {
  id: string;
  profileId?: string;
  role?: string;
};

/** Stable key for artwork counts and preview URLs (matches existing registry logic). */
export function registryRowKey(account: RegistryRowLike): string {
  return account.profileId && account.role === USER_ROLES.GALLERY
    ? `${account.id}-${account.profileId}`
    : account.id;
}
