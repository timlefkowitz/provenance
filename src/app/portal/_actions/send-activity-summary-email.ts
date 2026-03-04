'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { sendSummaryEmail } from '~/lib/email';
import type { SummaryItem } from '~/lib/email';

/**
 * Send the current user an activity summary email (example call site for summary emails).
 * Fetches their artworks count and recent activity to build the summary.
 */
export async function sendActivitySummaryEmail(): Promise<{ success: boolean; error: string | null }> {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: account } = await client
      .from('accounts')
      .select('email, name')
      .eq('id', user.id)
      .single();

    if (!account?.email) {
      return { success: false, error: 'No email on file for your account' };
    }

    const admin = getSupabaseServerAdminClient();
    const [artworksRes, recentRes] = await Promise.all([
      admin.from('artworks').select('*', { count: 'exact', head: true }).eq('account_id', user.id),
      admin
        .from('artworks')
        .select('title, created_at')
        .eq('account_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const count = artworksRes.count ?? 0;
    const recent = recentRes.data ?? [];
    const items: SummaryItem[] = [
      { title: 'Your portfolio', description: `${count} artwork${count !== 1 ? 's' : ''} on Provenance` },
    ];
    if (recent.length > 0) {
      items.push({
        title: 'Recent activity',
        description: `Latest: "${recent[0].title}"${recent.length > 1 ? ` and ${recent.length - 1} more` : ''}`,
      });
    } else if (count === 0) {
      items.push({ title: 'Get started', description: 'Add your first artwork to generate a certificate of authenticity.' });
    }

    const userName = account.name || account.email.split('@')[0] || 'there';
    await sendSummaryEmail(
      account.email,
      userName,
      'Your Provenance activity summary',
      items,
      'Activity summary'
    );

    return { success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send summary email';
    console.error('sendActivitySummaryEmail error:', err);
    return { success: false, error: message };
  }
}
