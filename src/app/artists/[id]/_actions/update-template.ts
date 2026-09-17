'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { asUntyped } from '~/lib/supabase-untyped';

import { isValidTemplateId, type TemplateId } from '../_components/template-registry';

/**
 * Persists the caller's chosen artist-profile template so it shows for every
 * visitor, not just in the caller's own browser. Only the profile owner may
 * change their own template.
 */
export async function updateArtistTemplate(templateId: TemplateId | null) {
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

    const { data: account, error: fetchError } = await client
      .from('accounts')
      .select('public_data')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching account:', fetchError);
      return { error: 'Failed to fetch account data' };
    }

    const currentPublicData =
      (account?.public_data as Record<string, unknown>) || {};
    const updatedPublicData: Record<string, unknown> = {
      ...currentPublicData,
      template: templateId,
    };

    const { error } = await client
      .from('accounts')
      .update({ public_data: updatedPublicData })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating template:', error);
      return { error: error.message || 'Failed to update template' };
    }

    revalidatePath(`/artists/${user.id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in updateArtistTemplate:', error);
    return { error: 'An unexpected error occurred' };
  }
}
