'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getActiveSubscription } from '~/lib/subscription';
import {
  isGoDaddyConfigured,
  searchDomainAvailability,
  type DomainSearchResult,
} from '~/lib/godaddy';

export type SearchDomainAvailabilityResult =
  | { success: true; results: DomainSearchResult[] }
  | { success: false; error: string };

/**
 * Search domain availability across curated TLDs via GoDaddy API.
 * Requires an active subscription.
 */
export async function searchDomainAvailabilityAction(
  label: string,
): Promise<SearchDomainAvailabilityResult> {
  console.log('[Sites] searchDomainAvailabilityAction', { label });

  if (!isGoDaddyConfigured()) {
    return {
      success: false,
      error: 'Domain search is not configured on this deployment.',
    };
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await client.auth.getUser();

  if (authErr || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    return {
      success: false,
      error: 'An active subscription is required to search for domains.',
    };
  }

  try {
    const results = await searchDomainAvailability(label);
    const availableCount = results.filter((r) => r.available).length;
    console.log('[Sites] searchDomainAvailabilityAction success', {
      label,
      availableCount,
    });
    return { success: true, results };
  } catch (err) {
    console.error('[Sites] searchDomainAvailabilityAction failed', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Domain search failed',
    };
  }
}
