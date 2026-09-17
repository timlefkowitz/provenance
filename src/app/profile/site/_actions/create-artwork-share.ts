'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { generateShareToken, hashShareToken } from '~/lib/share-links/tokens';

export async function createArtworkShare({
  tagId,
  recipientEmail,
  expiresInDays,
}: {
  tagId: string;
  recipientEmail?: string;
  expiresInDays?: number;
}): Promise<{ success: boolean; url?: string; error?: string }> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false, error: 'You must be signed in' };
  }

  const { data: tag, error: tagError } = await client
    .from('tags')
    .select('id, name, account_id')
    .eq('id', tagId)
    .single();

  if (tagError || !tag || tag.account_id !== user.id) {
    return { success: false, error: 'Tag not found' };
  }

  const token = generateShareToken();
  const tokenHash = hashShareToken(token);
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const adminClient = asUntyped(getSupabaseServerAdminClient());
  const { error: insertError } = await adminClient.from('artwork_shares').insert({
    account_id: user.id,
    tag_id: tagId,
    title: tag.name,
    token_hash: tokenHash,
    recipient_email: recipientEmail?.trim() || null,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error('[Shares] createArtworkShare failed', insertError);
    return { success: false, error: 'Could not create share link' };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return { success: true, url: `${siteUrl}/share/${token}` };
}
