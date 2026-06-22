'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

/**
 * Initialises PostHog once on the client and exposes it as window.posthog
 * so capturePostHogEvent() can reach it from any component without needing
 * a context subscription.
 *
 * Place this high in the tree (inside RootProviders or the root layout body)
 * so it loads before any feature that needs to fire events.
 */
export function PostHogProvider() {
  useEffect(() => {
    if (!POSTHOG_KEY) {
      console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY not set — analytics disabled');
      return;
    }

    if ((window as unknown as { posthog?: typeof posthog }).posthog) {
      // Already initialised (e.g. hot-reload)
      return;
    }

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Capture pageviews automatically
      capture_pageview: true,
      // Session replay — PostHog will respect sampling config in the project
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-ph-mask]',
      },
      // Respect cookie consent: start in opted-out mode and opt in after consent
      opt_out_capturing_by_default: false,
      // Don't track bots or prerendering
      disable_session_recording: false,
      persistence: 'localStorage+cookie',
    });

    // Expose globally so capturePostHogEvent() works without a React context
    (window as unknown as { posthog: typeof posthog }).posthog = posthog;

    console.log('[PostHog] Initialised');
  }, []);

  return null;
}

/**
 * Identify the current user in PostHog once auth is known.
 * Call this from any component that has the authenticated user available.
 */
export function identifyPostHogUser(userId: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const ph = (window as unknown as { posthog?: typeof posthog }).posthog;
  if (!ph) return;
  ph.identify(userId, properties);
  console.log('[PostHog] identify', userId);
}
