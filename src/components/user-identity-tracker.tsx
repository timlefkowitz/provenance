'use client';

import { useEffect, useRef } from 'react';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { identifyPostHogUser } from '~/components/posthog-provider';

interface Props {
  /** User ID from the server — null/undefined when not authenticated. */
  userId?: string | null;
}

/**
 * Identifies the current user in PostHog so every subsequent event is
 * attached to a named person with role + email properties.
 *
 * Runs once per session (guarded by `identified` ref). Fetches the role from
 * the accounts table client-side so we don't slow down the layout render.
 * No-ops for unauthenticated visitors.
 */
export function UserIdentityTracker({ userId }: Props) {
  const client = useSupabase();
  const identified = useRef(false);

  useEffect(() => {
    if (!userId || identified.current) return;

    async function identify() {
      try {
        const { data: account } = await (client as any)
          .from('accounts')
          .select('email, name, public_data')
          .eq('id', userId)
          .single();

        const role = (account?.public_data as Record<string, unknown> | null)?.role as string | undefined;

        identifyPostHogUser(userId!, {
          email: account?.email ?? undefined,
          name: account?.name ?? undefined,
          role: role ?? 'unknown',
        });

        identified.current = true;
        console.log('[PostHog] user identified', { userId, role });
      } catch (err) {
        console.error('[PostHog] identify failed', err);
      }
    }

    identify();
  }, [userId, client]);

  return null;
}
