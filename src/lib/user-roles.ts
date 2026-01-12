/**
 * User role definitions
 * These roles are used throughout the application to categorize users
 */
export const USER_ROLES = {
  COLLECTOR: 'collector',
  ARTIST: 'artist',
  GALLERY: 'gallery',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * All valid user roles as an array
 */
export const ALL_USER_ROLES: UserRole[] = [
  USER_ROLES.COLLECTOR,
  USER_ROLES.ARTIST,
  USER_ROLES.GALLERY,
];

/**
 * Check if a role is valid
 */
export function isValidRole(role: string | undefined | null): role is UserRole {
  if (!role) return false;
  return Object.values(USER_ROLES).includes(role as UserRole);
}

/**
 * Get role display label
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    [USER_ROLES.COLLECTOR]: 'Collector',
    [USER_ROLES.ARTIST]: 'Artist',
    [USER_ROLES.GALLERY]: 'Gallery',
  };
  return labels[role] || role;
}

/**
 * Get role from account public_data
 */
export function getUserRole(publicData: Record<string, any> | null | undefined): UserRole | null {
  if (!publicData?.role) return null;
  const role = publicData.role as string;
  return isValidRole(role) ? role : null;
}

