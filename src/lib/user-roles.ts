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
 * Gallery → Certificate of Show; Collector → Certificate of Ownership; Artist → Certificate of Authenticity.
 * After artist claims and owner approves, type becomes authenticity.
 */
export const CERTIFICATE_TYPES = {
  AUTHENTICITY: 'authenticity',
  SHOW: 'show',
  OWNERSHIP: 'ownership',
} as const;

export type CertificateType = typeof CERTIFICATE_TYPES[keyof typeof CERTIFICATE_TYPES];

export function getCertificateTypeForRole(role: UserRole | null): CertificateType {
  if (role === USER_ROLES.GALLERY) return CERTIFICATE_TYPES.SHOW;
  if (role === USER_ROLES.COLLECTOR) return CERTIFICATE_TYPES.OWNERSHIP;
  return CERTIFICATE_TYPES.AUTHENTICITY;
}

export function getCertificateTypeLabel(type: CertificateType | string): string {
  const labels: Record<string, string> = {
    [CERTIFICATE_TYPES.AUTHENTICITY]: 'Certificate of Authenticity',
    [CERTIFICATE_TYPES.SHOW]: 'Certificate of Show',
    [CERTIFICATE_TYPES.OWNERSHIP]: 'Certificate of Ownership',
    collection: 'Certificate of Ownership', // legacy value
  };
  return labels[type] || labels[CERTIFICATE_TYPES.AUTHENTICITY];
}

/** Button label when creating certificates: "Create Certificate of Show" / "Create 3 Certificates of Show" etc. */
export function getCreateCertificateButtonLabel(role: UserRole | null, count: number): string {
  const type = getCertificateTypeForRole(role);
  const suffix = getCertificateTypeLabel(type).replace(/^Certificate of /i, ''); // "Show" | "Ownership" | "Authenticity"
  const plural = count !== 1;
  const certWord = plural ? 'Certificates' : 'Certificate';
  const prefix = count > 0 ? `Create ${count} ` : 'Create ';
  return `${prefix}${certWord} of ${suffix}`;
}

