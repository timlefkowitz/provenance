'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function getFeaturedEntry() {
  try {
    const client = getSupabaseServerClient();
    
    // Get featured entry from a special account (or use a config approach)
    // For now, we'll store it in a special "site_config" account or use public_data
    // Let's use a simple approach: store in any admin account's public_data.featured_entry
    
    // Get the first admin account's featured entry
    const { data: adminAccounts } = await client
      .from('accounts')
      .select('public_data')
      .limit(1);

    // Check all accounts for featured_entry in public_data
    const { data: allAccounts } = await client
      .from('accounts')
      .select('id, public_data')
      .limit(100);

    // Find featured entry in any account's public_data
    for (const account of allAccounts || []) {
      const publicData = account.public_data as Record<string, any>;
      if (publicData?.featured_entry) {
        return {
          featuredEntry: publicData.featured_entry as {
            artwork_id: string | null;
            title: string;
            description: string;
            link_url: string;
            image_url: string | null;
          },
        };
      }
    }

    // Return default if none found
    return {
      featuredEntry: null,
    };
  } catch (error) {
    console.error('Error getting featured entry:', error);
    return {
      featuredEntry: null,
      error: 'Failed to load featured entry',
    };
  }
}

