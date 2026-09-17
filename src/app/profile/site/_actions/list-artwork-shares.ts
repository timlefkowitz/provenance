'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

export type ArtworkShare = {
  id: string;
  tag_id: string;
  title: string | null;
  recipient_email: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
};

export async function listArtworkShares(): Promise<ArtworkShare[]> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const adminClient = asUntyped(getSupabaseServerAdminClient());
  const { data, error } = await adminClient
    .from('artwork_shares')
    .select('id, tag_id, title, recipient_email, expires_at, revoked_at, view_count, last_viewed_at, created_at')
    .eq('account_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Shares] listArtworkShares failed', error);
    return [];
  }

  return data ?? [];
}
