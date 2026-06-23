'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

type UpdateProposalInput = {
  id: string;
  title?: string;
  contentJson?: object | null;
  contentText?: string | null;
  status?: string;
};

/**
 * Update an existing proposal document (owner only).
 */
export async function updateProposal(input: UpdateProposalInput) {
  console.log('[Proposals] updateProposal', { id: input.id });
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[Proposals] updateProposal: not authenticated', authError);
    return { success: false, error: 'Not authenticated' };
  }

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.contentJson !== undefined) updates.content_json = input.contentJson;
  if (input.contentText !== undefined) updates.content_text = input.contentText;
  if (input.status !== undefined) updates.status = input.status;

  const { error } = await (client as any)
    .from('grant_proposals')
    .update(updates)
    .eq('id', input.id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Proposals] updateProposal failed', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
