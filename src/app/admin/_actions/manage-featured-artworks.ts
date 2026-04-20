'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { isAdmin } from '~/lib/admin';
import { sendArtworkFeaturedEmail } from '~/lib/email';
import { revalidatePath } from 'next/cache';

/**
 * Resolve the owner email for an account, falling back to auth.users when
 * accounts.email is null (e.g. team/gallery accounts or older rows).
 */
async function resolveOwnerEmail(
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  accountId: string,
): Promise<{ email: string; name: string } | null> {
  const { data: account } = await adminClient
    .from('accounts')
    .select('email, name')
    .eq('id', accountId)
    .single();

  if (account?.email) {
    return { email: account.email, name: account.name || '' };
  }

  // Fallback: look up directly in auth.users (covers gallery/team accounts
  // where accounts.email may be null, or older rows before the email trigger)
  try {
    const { data: authUser } = await (adminClient.auth.admin as any).getUserById(accountId);
    if (authUser?.user?.email) {
      return { email: authUser.user.email, name: account?.name || '' };
    }
  } catch {
    // auth.admin may not be available in all environments
  }

  return null;
}

/**
 * Send the artwork_featured email for a single artwork. Shared by both the
 * add-featured flow and the retroactive bulk-send action.
 */
async function sendFeaturedEmailForArtwork(
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  artworkId: string,
  accountId: string,
  artistName: string | null,
  artworkTitle: string,
): Promise<void> {
  const owner = await resolveOwnerEmail(adminClient, accountId);
  if (!owner) {
    console.log('[FeaturedArtworks] No owner email found for artwork, skipping email', {
      artworkId,
      accountId,
    });
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
  const artworkUrl = `${siteUrl}/artworks/${artworkId}`;
  const resolvedName =
    artistName || owner.name || owner.email.split('@')[0] || 'Artist';

  console.log('[FeaturedArtworks] Sending artwork_featured email to', owner.email);
  await sendArtworkFeaturedEmail(owner.email, resolvedName, artworkTitle, artworkUrl);
  console.log('[FeaturedArtworks] artwork_featured email sent to', owner.email);
}

/**
 * Get all featured artwork IDs across all accounts (consolidated)
 * Optimized to only fetch accounts that might have featured_artworks
 */
async function getAllFeaturedArtworkIds(): Promise<string[]> {
  const adminClient = getSupabaseServerAdminClient();
  
  // Use a more efficient query - only get accounts where public_data contains featured_artworks
  // Note: This is a simplified approach. For better performance, consider creating a separate table
  const { data: allAccounts } = await adminClient
    .from('accounts')
    .select('id, public_data')
    .not('public_data', 'is', null)
    .limit(100);

  // Collect ALL featured artwork IDs from ALL accounts
  const allFeaturedIds: string[] = [];
  const seenIds = new Set<string>(); // Use Set for O(1) lookup instead of includes
  
  for (const account of allAccounts || []) {
    const publicData = account.public_data as Record<string, any>;
    if (publicData?.featured_artworks && Array.isArray(publicData.featured_artworks)) {
      // Add all IDs from this account (avoid duplicates)
      for (const id of publicData.featured_artworks) {
        if (typeof id === 'string' && !seenIds.has(id)) {
          seenIds.add(id);
          allFeaturedIds.push(id);
        }
      }
    }
  }

  return allFeaturedIds;
}

/**
 * Get the account ID that has the featured_artworks array, or return null if none exists
 */
async function getFeaturedArtworksAccountId(): Promise<string | null> {
  const adminClient = getSupabaseServerAdminClient();
  
  const { data: allAccounts } = await adminClient
    .from('accounts')
    .select('id, public_data')
    .limit(100);

  // Find the first account with featured_artworks array
  for (const account of allAccounts || []) {
    const publicData = account.public_data as Record<string, any>;
    if (publicData?.featured_artworks && Array.isArray(publicData.featured_artworks)) {
      return account.id;
    }
  }

  return null;
}

/**
 * Check if an artwork is already featured
 */
export async function isArtworkFeatured(artworkId: string): Promise<boolean> {
  try {
    const featuredIds = await getAllFeaturedArtworkIds();
    return featuredIds.includes(artworkId);
  } catch (error) {
    console.error('Error checking if artwork is featured:', error);
    return false;
  }
}

export async function addFeaturedArtwork(artworkId: string) {
  console.log('[FeaturedArtworks] addFeaturedArtwork started', { artworkId });
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to manage featured artworks' };
    }

    const adminClient = getSupabaseServerAdminClient();

    // Verify artwork exists and is verified — also fetch fields needed for email and featured update
    const { data: artwork, error: artworkError } = await (adminClient as any)
      .from('artworks')
      .select('id, status, title, artist_name, account_id')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      return { error: 'Artwork not found' };
    }

    if (artwork.status !== 'verified') {
      return { error: 'Only verified artworks can be featured' };
    }

    // Check across all accounts if artwork is already featured
    const allFeaturedIds = await getAllFeaturedArtworkIds();
    if (allFeaturedIds.includes(artworkId)) {
      return { error: 'This artwork is already featured' };
    }

    // Check if we've reached the limit of 10
    if (allFeaturedIds.length >= 10) {
      return { error: 'Maximum of 10 featured artworks allowed. Please remove one first.' };
    }

    // Prefer the current admin's own account so the canonical list lives there.
    // If a different account currently holds featured_artworks, we'll migrate and clean it up below.
    const existingFeaturedAccountId = await getFeaturedArtworksAccountId();
    const targetAccountId = user.id;
    console.log('[FeaturedArtworks] addFeaturedArtwork target account', {
      targetAccountId,
      existingFeaturedAccountId,
    });

    // Get target account data via admin client so RLS cannot silently drop the row
    const { data: account } = await adminClient
      .from('accounts')
      .select('public_data')
      .eq('id', targetAccountId)
      .single();

    if (!account) {
      console.error('[FeaturedArtworks] Target account not found', { targetAccountId });
      return { error: 'Account not found' };
    }

    const currentPublicData = (account.public_data as Record<string, any>) || {};

    // Consolidate: use all featured IDs from all accounts, then add the new one
    // This ensures we don't lose any artworks that might be in other accounts
    const consolidatedFeaturedArtworks = [...allFeaturedIds, artworkId];

    // Remove duplicates (shouldn't happen, but just in case)
    const uniqueFeaturedArtworks = Array.from(new Set(consolidatedFeaturedArtworks));

    // Update public_data on the target account with consolidated list.
    // We use the admin client because RLS on accounts only allows auth.uid()=id for UPDATE,
    // and the targetAccountId may differ from the current user's row; admin access is
    // already gated by the isAdmin() check above.
    const { data: updatedRows, error } = await adminClient
      .from('accounts')
      .update({
        public_data: {
          ...currentPublicData,
          featured_artworks: uniqueFeaturedArtworks,
        },
      })
      .eq('id', targetAccountId)
      .select('id');

    if (error) {
      console.error('[FeaturedArtworks] Error adding featured artwork', error);
      return { error: error.message || 'Failed to add featured artwork' };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.error('[FeaturedArtworks] Update affected 0 rows', { targetAccountId });
      return { error: 'Failed to add featured artwork: no account row updated' };
    }

    // Mark artwork as featured in the artworks table (non-fatal if it fails)
    const { error: featuredFlagError } = await (adminClient as any)
      .from('artworks')
      .update({ featured: true, featured_at: new Date().toISOString() })
      .eq('id', artworkId);
    if (featuredFlagError) {
      console.error('[FeaturedArtworks] Failed to set artworks.featured flag (non-fatal)', featuredFlagError);
    } else {
      console.log('[FeaturedArtworks] artworks.featured set to true for', artworkId);
    }

    // Send notification email to the artwork's owner (non-fatal)
    try {
      await sendFeaturedEmailForArtwork(adminClient, artworkId, artwork.account_id, artwork.artist_name, artwork.title);
    } catch (emailErr) {
      console.error('[FeaturedArtworks] artwork_featured email send failed (non-fatal)', emailErr);
    }

    // Clean up: remove featured_artworks from any OTHER accounts so the canonical list
    // stays on targetAccountId. Uses admin client because these rows may belong to other users.
    const { data: otherAccounts } = await adminClient
      .from('accounts')
      .select('id, public_data')
      .neq('id', targetAccountId)
      .limit(100);

    for (const otherAccount of otherAccounts || []) {
      const otherPublicData = (otherAccount.public_data as Record<string, any>) || {};
      if (otherPublicData?.featured_artworks && Array.isArray(otherPublicData.featured_artworks)) {
        const { featured_artworks, ...restPublicData } = otherPublicData;
        await adminClient
          .from('accounts')
          .update({
            public_data: restPublicData,
          })
          .eq('id', otherAccount.id);
        console.log('[FeaturedArtworks] Cleaned featured_artworks from other account', {
          accountId: otherAccount.id,
        });
      }
    }

    console.log(
      `[FeaturedArtworks] featured_artworks now has ${uniqueFeaturedArtworks.length} items on account ${targetAccountId}`,
    );

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/queued-artworks');
    revalidatePath(`/artworks/${artworkId}/certificate`);

    return { success: true };
  } catch (error) {
    console.error('[FeaturedArtworks] addFeaturedArtwork failed', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function removeFeaturedArtwork(artworkId: string) {
  console.log('[FeaturedArtworks] removeFeaturedArtwork started', { artworkId });
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to manage featured artworks' };
    }

    const adminClient = getSupabaseServerAdminClient();

    // Find the account that has the featured_artworks array
    const featuredAccountId = await getFeaturedArtworksAccountId();
    if (!featuredAccountId) {
      return { error: 'No featured artworks found' };
    }
    console.log('[FeaturedArtworks] removeFeaturedArtwork target account', {
      featuredAccountId,
    });

    // Get account data via admin client so RLS cannot silently drop the row
    const { data: account } = await adminClient
      .from('accounts')
      .select('public_data')
      .eq('id', featuredAccountId)
      .single();

    if (!account) {
      console.error('[FeaturedArtworks] Featured account not found', { featuredAccountId });
      return { error: 'Account not found' };
    }

    const currentPublicData = (account.public_data as Record<string, any>) || {};
    const featuredArtworks = (currentPublicData.featured_artworks as string[]) || [];

    // Remove from list
    const updatedFeaturedArtworks = featuredArtworks.filter((id: string) => id !== artworkId);

    // Update public_data on the account that has featured artworks.
    // We use the admin client because RLS on accounts only allows auth.uid()=id for UPDATE,
    // and the featuredAccountId may differ from the current user's row; admin access is
    // already gated by the isAdmin() check above.
    const { data: updatedRows, error } = await adminClient
      .from('accounts')
      .update({
        public_data: {
          ...currentPublicData,
          featured_artworks: updatedFeaturedArtworks,
        },
      })
      .eq('id', featuredAccountId)
      .select('id');

    if (error) {
      console.error('[FeaturedArtworks] Error removing featured artwork', error);
      return { error: error.message || 'Failed to remove featured artwork' };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.error('[FeaturedArtworks] Remove update affected 0 rows', { featuredAccountId });
      return { error: 'Failed to remove featured artwork: no account row updated' };
    }

    console.log(
      `[FeaturedArtworks] featured_artworks now has ${updatedFeaturedArtworks.length} items on account ${featuredAccountId}`,
    );

    // Clear featured flag on the artwork (non-fatal)
    const { error: clearFlagError } = await (adminClient as any)
      .from('artworks')
      .update({ featured: false, featured_at: null })
      .eq('id', artworkId);
    if (clearFlagError) {
      console.error('[FeaturedArtworks] Failed to clear artworks.featured flag (non-fatal)', clearFlagError);
    } else {
      console.log('[FeaturedArtworks] artworks.featured cleared for', artworkId);
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/queued-artworks');

    return { success: true };
  } catch (error) {
    console.error('[FeaturedArtworks] removeFeaturedArtwork failed', error);
    return { error: 'An unexpected error occurred' };
  }
}

/**
 * Retroactively send the artwork_featured notification email to every owner
 * of the current featured artworks queue. Safe to call more than once — the
 * email system is fire-and-forget, but you should only use this for artworks
 * that were featured before the per-add email was wired up.
 */
export async function sendFeaturedNotificationsToAll(): Promise<{
  sent: number;
  skipped: number;
  errors: number;
  error?: string;
}> {
  console.log('[FeaturedArtworks] sendFeaturedNotificationsToAll started');
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) return { sent: 0, skipped: 0, errors: 0, error: 'You must be signed in' };

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { sent: 0, skipped: 0, errors: 0, error: 'You do not have permission' };
    }

    const adminClient = getSupabaseServerAdminClient();
    const featuredIds = await getAllFeaturedArtworkIds();

    if (featuredIds.length === 0) {
      console.log('[FeaturedArtworks] sendFeaturedNotificationsToAll: no featured artworks');
      return { sent: 0, skipped: 0, errors: 0 };
    }

    const { data: artworks } = await (adminClient as any)
      .from('artworks')
      .select('id, title, artist_name, account_id')
      .in('id', featuredIds);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const artwork of artworks || []) {
      try {
        const owner = await resolveOwnerEmail(adminClient, artwork.account_id);
        if (!owner) {
          console.log('[FeaturedArtworks] No email for artwork, skipping', artwork.id);
          skipped++;
          continue;
        }
        await sendFeaturedEmailForArtwork(
          adminClient,
          artwork.id,
          artwork.account_id,
          artwork.artist_name,
          artwork.title,
        );
        sent++;
      } catch (err) {
        console.error('[FeaturedArtworks] Error sending email for artwork', artwork.id, err);
        errors++;
      }
    }

    console.log('[FeaturedArtworks] sendFeaturedNotificationsToAll complete', { sent, skipped, errors });
    return { sent, skipped, errors };
  } catch (error) {
    console.error('[FeaturedArtworks] sendFeaturedNotificationsToAll failed', error);
    return { sent: 0, skipped: 0, errors: 1, error: 'An unexpected error occurred' };
  }
}

