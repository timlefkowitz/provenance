'use server';

/* eslint-disable @typescript-eslint/no-explicit-any -- artworks/exhibitions RLS queries use loosely typed Supabase rows */

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import {
  CERTIFICATE_TYPES,
  getCertificateTypeForRole,
  getUserRole,
  USER_ROLES,
  type CertificateType,
  type UserRole,
} from '~/lib/user-roles';

export type ExhibitionPosterContext = {
  userRole: UserRole | null;
  certificateType: CertificateType;
  /** user_profiles.id for gallery or institution, when posting show certificates */
  galleryProfileId: string | null;
};

/**
 * Resolves poster role (from accounts.public_data), certificate type, and default profile row
 * for exhibition quick listings / publishing (mirror semantics of artwork batch create).
 */
export async function getExhibitionPosterContext(
  posterAccountId: string,
): Promise<ExhibitionPosterContext> {
  const client = getSupabaseServerClient();
  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', posterAccountId)
    .maybeSingle();

  const userRole = getUserRole(account?.public_data as Record<string, unknown>);
  const certificateType = getCertificateTypeForRole(userRole);

  let galleryProfileId: string | null = null;
  if (userRole === USER_ROLES.GALLERY) {
    const p = await getUserProfileByRole(posterAccountId, USER_ROLES.GALLERY);
    galleryProfileId = p?.id ?? null;
  } else if (userRole === USER_ROLES.INSTITUTION) {
    const p = await getUserProfileByRole(posterAccountId, USER_ROLES.INSTITUTION);
    galleryProfileId = p?.id ?? null;
  }

  return { userRole, certificateType, galleryProfileId };
}

/**
 * Validates that the poster may attach gallery_profile_id to an artwork row (owned profile or gallery member).
 */
export async function canAttachGalleryProfile(
  posterUserId: string,
  galleryProfileId: string,
): Promise<boolean> {
  const client = getSupabaseServerClient();
  try {
    const { data: profile } = await (client as any)
      .from('user_profiles')
      .select('id, user_id, role')
      .eq('id', galleryProfileId)
      .maybeSingle();

    if (!profile) return false;
    if (
      profile.role !== USER_ROLES.GALLERY &&
      profile.role !== USER_ROLES.INSTITUTION
    ) {
      return false;
    }

    if (profile.user_id === posterUserId) return true;

    // Institution profiles are not shared via gallery_members in the typical model.
    if (profile.role === USER_ROLES.INSTITUTION) return false;

    const { data: member } = await (client as any)
      .from('gallery_members')
      .select('id')
      .eq('gallery_profile_id', galleryProfileId)
      .eq('user_id', posterUserId)
      .maybeSingle();

    return !!member;
  } catch {
    return false;
  }
}

/** Show certificates align with CERTIFICATE_TYPES.SHOW (gallery / institution poster roles). */
export function isEligibleForShowCertificate(context: ExhibitionPosterContext): boolean {
  return context.certificateType === CERTIFICATE_TYPES.SHOW;
}
