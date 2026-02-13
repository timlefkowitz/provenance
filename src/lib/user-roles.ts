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

/**
 * Certificate type by poster role:
 * Gallery → Certificate of Show; Collector → Certificate of Collection; Artist → Certificate of Authenticity
 */
export const CERTIFICATE_TYPES = {
  AUTHENTICITY: 'authenticity',
  SHOW: 'show',
  COLLECTION: 'collection',
} as const;

export type CertificateType = typeof CERTIFICATE_TYPES[keyof typeof CERTIFICATE_TYPES];

export function getCertificateTypeForRole(role: UserRole | null): CertificateType {
  if (role === USER_ROLES.GALLERY) return CERTIFICATE_TYPES.SHOW;
  if (role === USER_ROLES.COLLECTOR) return CERTIFICATE_TYPES.COLLECTION;
  return CERTIFICATE_TYPES.AUTHENTICITY;
}

export function getCertificateTypeLabel(type: CertificateType): string {
  const labels: Record<CertificateType, string> = {
    [CERTIFICATE_TYPES.AUTHENTICITY]: 'Certificate of Authenticity',
    [CERTIFICATE_TYPES.SHOW]: 'Certificate of Show',
    [CERTIFICATE_TYPES.COLLECTION]: 'Certificate of Collection',
  };
  return labels[type] || labels[CERTIFICATE_TYPES.AUTHENTICITY];
}

