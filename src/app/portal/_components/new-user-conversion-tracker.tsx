'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { gtmService } from '~/lib/gtm';

/**
 * Inner component that reads search params and fires GTM conversion events.
 * Must be wrapped in <Suspense> because useSearchParams() opts the subtree
 * into client-side rendering in the App Router.
 */
function Tracker() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('new_user') !== '1') return;

    console.log('[GTM] New user landing on portal — firing signup + trial_started events');
    gtmService.trackSignup();
    gtmService.trackTrialStarted();

    // Remove the query param so the URL stays clean on subsequent visits
    const url = new URL(window.location.href);
    url.searchParams.delete('new_user');
    router.replace(url.pathname + (url.search || ''), { scroll: false });
  }, [searchParams, router]);

  return null;
}

/**
 * Drop-in client component for the portal page.
 * Fires signup + trial_started GTM events exactly once when a new user
 * arrives via the auth callback redirect (?new_user=1).
 */
export function NewUserConversionTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
