/**
 * PostHog product analytics.
 *
 * Server-safe: all exports guard against window/process being absent.
 * Client-side capture goes through posthog-js (see posthog-provider.tsx).
 * This module defines the canonical event catalogue so every call-site
 * uses the same strings.
 */

// ─── Event catalogue ────────────────────────────────────────────────────────

export const PH_EVENTS = {
  // Acquisition
  SIGNUP: 'signup',
  TRIAL_STARTED: 'trial_started',

  // Activation (North Star: new user → first published certificate within 24 h)
  ONBOARDING_COMPLETE: 'onboarding_complete',
  FIRST_RUN_STARTED: 'first_run_started',
  CERTIFICATE_CREATED: 'certificate_created',
  CERTIFICATE_PUBLISHED: 'certificate_published',

  // Viral loop
  CERTIFICATE_CLAIMED: 'certificate_claimed',
  CERTIFICATE_INVITE_SENT: 'certificate_invite_sent',
  CERTIFICATE_VERIFY_CTA_CLICKED: 'certificate_verify_cta_clicked',

  // Retention
  TRIAL_NUDGE_EMAIL_SENT: 'trial_nudge_email_sent',
  DIGEST_EMAIL_SENT: 'digest_email_sent',

  // Revenue
  SUBSCRIPTION_STARTED: 'subscription_started',
  UPGRADE_PROMPT_SHOWN: 'upgrade_prompt_shown',
  UPGRADE_PROMPT_CLICKED: 'upgrade_prompt_clicked',
} as const;

export type PhEvent = (typeof PH_EVENTS)[keyof typeof PH_EVENTS];

// ─── Client-side capture helper (browser only) ──────────────────────────────

/**
 * Capture a PostHog event from client code.
 * No-ops when PostHog is not initialised or we're on the server.
 */
export function capturePostHogEvent(
  event: PhEvent,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  // posthog-js is loaded by PostHogProvider; access via the global
  const ph = (window as unknown as { posthog?: { capture: (e: string, p?: Record<string, unknown>) => void } }).posthog;
  if (!ph?.capture) return;
  console.log('[PostHog]', event, properties);
  ph.capture(event, properties);
}
