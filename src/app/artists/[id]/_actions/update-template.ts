'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isGalleryMember } from '~/app/profiles/_actions/gallery-members';
import { asUntyped } from '~/lib/supabase-untyped';
import { isTeamProfileRole } from '~/lib/user-roles';

import { isValidTemplateId, type TemplateId } from '../_components/template-registry';

/**
 * Persists the chosen public-page template on one role profile, so an account's
 * artist profile and each of its gallery profiles can look different. The
 * profile owner (or a gallery / institution team member) may change it.
 */
export async function updateProfileTemplate(profileId: string, templateId: TemplateId | null) {
  try {
    if (templateId !== null && !isValidTemplateId(templateId)) {
      return { error: 'Invalid template' };
    }

    const client = asUntyped(getSupabaseServerClient());
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to update your template' };
    }

    const { data: profile, error: fetchError } = await client
      .from('user_profiles')
      .select('id, user_id, role')
      .eq('id', profileId)
      .maybeSingle();

    if (fetchError || !profile) {
      console.error('[updateProfileTemplate] profile lookup failed', fetchError);
      return { error: 'Profile not found' };
    }

    const isOwner = profile.user_id === user.id;
    const isTeamMember =
      !isOwner && isTeamProfileRole(profile.role) && (await isGalleryMember(user.id, profileId));
    if (!isOwner && !isTeamMember) {
      return { error: 'You do not have permission to change this profile' };
    }

    const { error } = await client
      .from('user_profiles')
      .update({ template: templateId })
      .eq('id', profileId);

    if (error) {
      console.error('[updateProfileTemplate] update failed', error);
      return { error: error.message || 'Failed to update template' };
    }

    revalidatePath(`/artists/${profile.user_id}`);
    return { success: true };
  } catch (error) {
    console.error('[updateProfileTemplate] unexpected error', error);
    return { error: 'An unexpected error occurred' };
  }
}
