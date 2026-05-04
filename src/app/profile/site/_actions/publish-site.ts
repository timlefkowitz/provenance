'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getActiveSubscription } from '~/lib/subscription';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';

export type PublishSiteResult =
  | { success: true; url: string }
  | { success: false; error: string };

/**
 * Publish (or unpublish) a creator site.
 * Requires an active subscription.
 */
export async function publishSiteAction(
  profileId: string,
  published: boolean,
): Promise<PublishSiteResult> {
  console.log('[Sites] publishSiteAction', { profileId, published });

  const client = getSupabaseServerClient();

  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Require active subscription to publish
  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    return { success: false, error: 'An active subscription is required to publish your site.' };
  }

  // Verify ownership OR gallery team management access
  const { data: profile, error: profileErr } = await (client as any)
    .from('user_profiles')
    .select('id, user_id, role')
    .eq('id', profileId)
    .eq('is_active', true)
    .maybeSingle();

  if (profileErr || !profile) {
    return { success: false, error: 'Profile not found' };
  }

  let hasAccess = profile.user_id === user.id;
  if (!hasAccess && profile.role === 'gallery') {
    hasAccess = await canManageGallery(user.id, profileId);
  }
  if (!hasAccess) {
    return { success: false, error: 'You do not have permission to publish this site' };
  }

  // Fetch current site row to get handle
  const { data: siteRow, error: siteErr } = await (client as any)
    .from('profile_sites')
    .select('handle, published_at')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (siteErr || !siteRow) {
    return { success: false, error: 'Site not found. Save your site first.' };
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await (client as any)
    .from('profile_sites')
    .update({ published_at: published ? now : null, updated_at: now })
    .eq('profile_id', profileId);

  if (updateErr) {
    console.error('[Sites] publishSiteAction update failed', updateErr);
    return { success: false, error: updateErr.message };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://provenance.guru';
  const rawHost = new URL(baseUrl).hostname;
  const mainHost = rawHost.startsWith('www.') ? rawHost.slice(4) : rawHost;
  const siteUrl = `https://${siteRow.handle}.${mainHost}`;

  console.log('[Sites] publishSiteAction succeeded', { handle: siteRow.handle, published });
  return { success: true, url: siteUrl };
}
