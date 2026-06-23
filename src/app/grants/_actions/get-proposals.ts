'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type ProposalRow = {
  id: string;
  user_id: string;
  artist_profile_id: string | null;
  grant_id: string | null;
  title: string;
  content_json: object | null;
  content_text: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // joined
  grant_name?: string | null;
};

/**
 * Get all proposals for the current user, most-recently-updated first.
 * Joins grant name for display.
 */
export async function getProposals(): Promise<ProposalRow[]> {
  console.log('[Proposals] getProposals');
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[Proposals] getProposals: not authenticated', authError);
    return [];
  }

  const { data, error } = await (client as any)
    .from('grant_proposals')
    .select('*, artist_grants(name)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Proposals] getProposals failed', error);
    return [];
  }

  return ((data as any[]) || []).map((row) => ({
    ...row,
    grant_name: row.artist_grants?.name ?? null,
    artist_grants: undefined,
  }));
}

/**
 * Get a single proposal by id (owner check enforced by RLS).
 */
export async function getProposal(id: string): Promise<ProposalRow | null> {
  console.log('[Proposals] getProposal', id);
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[Proposals] getProposal: not authenticated', authError);
    return null;
  }

  const { data, error } = await (client as any)
    .from('grant_proposals')
    .select('*, artist_grants(name)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('[Proposals] getProposal failed', error);
    return null;
  }

  return {
    ...(data as any),
    grant_name: (data as any).artist_grants?.name ?? null,
    artist_grants: undefined,
  };
}
