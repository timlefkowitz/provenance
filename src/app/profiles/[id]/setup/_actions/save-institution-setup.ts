'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';
import {
  institutionSetupPath,
  MAX_INSTITUTION_STATEMENT_LENGTH,
  shouldMakeExistingWorksPrivate,
} from '~/lib/institutions/institution-setup';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';
import { asUntyped } from '~/lib/supabase-untyped';
import { USER_ROLES } from '~/lib/user-roles';

export type SaveInstitutionSetupInput = {
  profileId: string;
  statement: string;
  pictureUrl: string;
  headerImageUrl: string;
  isPrivate: boolean;
  artworksPrivateByDefault: boolean;
};

export type SaveInstitutionSetupResult =
  | { ok: true; worksMadePrivate: number }
  | { ok: false; error: string };

/**
 * Saves an institution's setup answers. Owners and admins only. Turning on
 * "keep works private" also makes every work already filed under the
 * institution private.
 */
export async function saveInstitutionSetup(
  input: SaveInstitutionSetupInput,
): Promise<SaveInstitutionSetupResult> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to save.' };

  console.log('[InstitutionSetup] save started', { userId: user.id, profileId: input.profileId });

  if (!(await canManageGallery(user.id, input.profileId))) {
    return { ok: false, error: 'Only the institution’s owner or admins can change these settings.' };
  }

  const statement = input.statement.trim();
  if (statement.length > MAX_INSTITUTION_STATEMENT_LENGTH) {
    return { ok: false, error: `Keep the statement under ${MAX_INSTITUTION_STATEMENT_LENGTH} characters.` };
  }
  if (containsObjectionableText(statement)) {
    return { ok: false, error: OBJECTIONABLE_TEXT_MESSAGE };
  }

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, role, user_id, artworks_private_by_default, setup_completed_at')
    .eq('id', input.profileId)
    .maybeSingle();
  if (!profile || profile.role !== USER_ROLES.INSTITUTION) {
    return { ok: false, error: 'Institution not found.' };
  }

  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    bio: statement || null,
    picture_url: input.pictureUrl.trim() || null,
    header_image_url: input.headerImageUrl.trim() || null,
    is_private: input.isPrivate,
    artworks_private_by_default: input.artworksPrivateByDefault,
    updated_at: nowIso,
  };
  if (!profile.setup_completed_at) {
    update.setup_completed_at = nowIso;
    update.setup_completed_by = user.id;
  }

  const { error: updateError } = await admin
    .from('user_profiles')
    .update(update)
    .eq('id', input.profileId);
  if (updateError) {
    console.error('[InstitutionSetup] profile update failed', updateError);
    return { ok: false, error: 'Could not save. Please try again.' };
  }

  let worksMadePrivate = 0;
  if (
    shouldMakeExistingWorksPrivate(
      profile.artworks_private_by_default === true,
      input.artworksPrivateByDefault,
    )
  ) {
    const { data: hidden, error: worksError } = await admin
      .from('artworks')
      .update({ is_public: false, updated_by: user.id })
      .eq('gallery_profile_id', input.profileId)
      .eq('is_public', true)
      .select('id');
    if (worksError) {
      console.error('[InstitutionSetup] making existing works private failed', worksError);
      return { ok: false, error: 'Settings saved, but existing works could not be made private. Please try again.' };
    }
    worksMadePrivate = hidden?.length ?? 0;
  }

  console.log('[InstitutionSetup] save completed', {
    profileId: input.profileId,
    isPrivate: input.isPrivate,
    artworksPrivateByDefault: input.artworksPrivateByDefault,
    worksMadePrivate,
    firstSetup: !profile.setup_completed_at,
  });

  revalidatePath(institutionSetupPath(input.profileId));
  revalidatePath(`/profiles/${input.profileId}/edit`);
  if (profile.user_id) revalidatePath(`/artists/${profile.user_id}`);
  revalidatePath('/artworks/my');

  return { ok: true, worksMadePrivate };
}
