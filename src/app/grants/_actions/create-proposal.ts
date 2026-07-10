'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';

type CreateProposalInput = {
  title: string;
  grantId?: string | null;
  contentJson?: object | null;
  contentText?: string | null;
};

/**
 * Create a new grant proposal document for the current user.
 * Returns the new proposal id on success.
 */
export async function createProposal(input: CreateProposalInput) {
  console.log('[Proposals] createProposal', { title: input.title, grantId: input.grantId });
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[Proposals] createProposal: not authenticated', authError);
    return { success: false, error: 'Not authenticated', proposalId: null };
  }

  const artistProfile = await getUserProfileByRole(user.id, USER_ROLES.ARTIST);

  const { data, error } = await asUntyped(client)
    .from('grant_proposals')
    .insert({
      user_id: user.id,
      artist_profile_id: artistProfile?.id ?? null,
      grant_id: input.grantId ?? null,
      title: input.title,
      content_json: input.contentJson ?? null,
      content_text: input.contentText ?? null,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Proposals] createProposal insert failed', error);
    return { success: false, error: error.message, proposalId: null };
  }

  console.log('[Proposals] createProposal created', data.id);
  return { success: true, proposalId: data.id as string, error: null };
}
