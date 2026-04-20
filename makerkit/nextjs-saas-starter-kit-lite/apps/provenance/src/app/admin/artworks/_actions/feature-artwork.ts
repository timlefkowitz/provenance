'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { sendTemplatedEmail } from '~/lib/email';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://provenance.art';

export async function featureArtwork(artworkId: string): Promise<{ error?: string }> {
  console.log('[Admin/featureArtwork] started:', artworkId);

  try {
    const client = getSupabaseServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();

    if (authError || !user) {
      console.error('[Admin/featureArtwork] Not authenticated');
      return { error: 'Not authenticated' };
    }

    if (!isAdmin(user)) {
      console.error('[Admin/featureArtwork] Forbidden – not an admin:', user.email);
      return { error: 'Forbidden' };
    }

    const admin = getSupabaseServerAdminClient();

    // Fetch artwork + owner account email
    const { data: artwork, error: fetchError } = await (admin as any)
      .from('artworks')
      .select(`
        id,
        title,
        artist_name,
        account_id,
        featured,
        accounts!inner(email)
      `)
      .eq('id', artworkId)
      .single();

    if (fetchError || !artwork) {
      console.error('[Admin/featureArtwork] Artwork not found:', fetchError);
      return { error: 'Artwork not found' };
    }

    // Toggle: if already featured, un-feature; otherwise feature
    const nowFeaturing = !artwork.featured;

    const { error: updateError } = await (admin as any)
      .from('artworks')
      .update({
        featured: nowFeaturing,
        featured_at: nowFeaturing ? new Date().toISOString() : null,
      })
      .eq('id', artworkId);

    if (updateError) {
      console.error('[Admin/featureArtwork] Update failed:', updateError);
      return { error: updateError.message };
    }

    console.log(
      `[Admin/featureArtwork] Artwork ${artworkId} featured=${nowFeaturing}`,
    );

    // Send congratulations email only when featuring (not un-featuring)
    if (nowFeaturing) {
      const ownerEmail = (artwork.accounts as { email: string } | null)?.email;
      if (ownerEmail) {
        try {
          await sendTemplatedEmail({
            to: ownerEmail,
            templateKey: 'artwork_featured',
            placeholders: {
              artistName: artwork.artist_name ?? 'Artist',
              artworkTitle: artwork.title,
              artworkUrl: `${SITE_URL}/artworks/${artworkId}`,
              siteUrl: SITE_URL,
            },
          });
        } catch (emailErr) {
          // Email failure is non-fatal – the feature flag has already been saved
          console.error('[Admin/featureArtwork] Email send failed (non-fatal):', emailErr);
        }
      } else {
        console.warn('[Admin/featureArtwork] No owner email for artwork:', artworkId);
      }
    }

    revalidatePath('/');
    revalidatePath('/admin/artworks');
    revalidatePath(`/artworks/${artworkId}`);

    return {};
  } catch (err) {
    console.error('[Admin/featureArtwork] Unexpected error:', err);
    return { error: (err as Error).message };
  }
}

/**
 * Checks whether the signed-in user has admin privileges.
 *
 * Admin status is determined by `app_metadata.role === 'admin'` in the
 * Supabase JWT — set this via the Supabase dashboard or the Auth admin API.
 * You can also add a fallback env-var list for development:
 *   ADMIN_EMAILS=you@example.com,other@example.com
 */
function isAdmin(user: { id: string; email?: string | null; app_metadata?: Record<string, unknown> }): boolean {
  if (user.app_metadata?.role === 'admin') return true;

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.length > 0 && adminEmails.includes((user.email ?? '').toLowerCase());
}
