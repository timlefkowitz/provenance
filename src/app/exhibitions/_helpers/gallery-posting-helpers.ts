import { CERTIFICATE_TYPES, type CertificateType, type UserRole } from '~/lib/user-roles';

export type ExhibitionPosterContext = {
  userRole: UserRole | null;
  certificateType: CertificateType;
  /** user_profiles.id for gallery or institution, when posting show certificates */
  galleryProfileId: string | null;
};

/** Show certificates align with CERTIFICATE_TYPES.SHOW (gallery / institution poster roles). */
export function isEligibleForShowCertificate(context: ExhibitionPosterContext): boolean {
  return context.certificateType === CERTIFICATE_TYPES.SHOW;
}
