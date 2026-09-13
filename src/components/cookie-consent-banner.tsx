'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { useLegalModal } from '~/components/legal/legal-modal-context';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import { gtmService } from '~/lib/gtm';

const CONSENT_KEY = 'provenance_cookie_consent';
const subscribeToPlatform = () => () => undefined;

function getStoredConsent(): StoredConsent | null {
  return localStorage.getItem(CONSENT_KEY) as StoredConsent | null;
}

type StoredConsent = 'granted' | 'denied';

/**
 * EU-compliant cookie consent banner.
 *
 * - Reads prior choice from localStorage on mount to avoid SSR flash.
 * - On "Accept": updates Consent Mode v2 to 'granted' and persists to localStorage.
 * - On "Decline": updates Consent Mode v2 to 'denied' and persists to localStorage.
 * - Re-applies stored consent on every page load so GTM tags honour prior choice.
 * - In native Capacitor mode: analytics and advertising scripts are not loaded;
 *   the app therefore has no cookie-consent state to grant.
 */
export function CookieConsentBanner() {
  const { openLegalDocument } = useLegalModal();
  const [selectedConsent, setSelectedConsent] = useState<StoredConsent | null>(
    null,
  );
  const nativePlatform = useSyncExternalStore(
    subscribeToPlatform,
    isNativePlatform,
    () => false,
  );
  const storedConsent = useSyncExternalStore(
    subscribeToPlatform,
    getStoredConsent,
    () => null,
  );

  useEffect(() => {
    // Native apps don't show cookie banners. Their tracking scripts are gated
    // out at the component level, so do not grant Consent Mode here.
    if (nativePlatform) return;

    if (storedConsent === 'granted') {
      gtmService.grantConsent();
    } else if (storedConsent === 'denied') {
      gtmService.denyConsent();
    }
  }, [nativePlatform, storedConsent]);

  const handleAccept = () => {
    console.log('[GTM] Cookie consent accepted');
    localStorage.setItem(CONSENT_KEY, 'granted');
    gtmService.grantConsent();
    setSelectedConsent('granted');
  };

  const handleDecline = () => {
    console.log('[GTM] Cookie consent declined');
    localStorage.setItem(CONSENT_KEY, 'denied');
    gtmService.denyConsent();
    setSelectedConsent('denied');
  };

  // Don't render until we've checked localStorage, and don't render once resolved
  if (nativePlatform || selectedConsent || storedConsent) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
    >
      <div className="bg-parchment/95 border-wine/20 pointer-events-auto mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border px-5 py-4 shadow-xl backdrop-blur-sm sm:flex-row sm:items-center">
        <p className="text-ink/80 flex-1 font-serif text-sm leading-relaxed">
          We use cookies to measure ad performance and improve your experience.
          By clicking <strong className="text-ink font-semibold">Accept</strong>
          , you consent to our use of advertising and analytics cookies.{' '}
          <button
            type="button"
            onClick={() => openLegalDocument('cookies')}
            className="text-wine hover:text-wine/80 underline underline-offset-2 transition-colors"
          >
            Learn more
          </button>
          .
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleDecline}
            className="border-wine/30 text-ink/80 hover:bg-wine/5 hover:border-wine/50 focus-visible:ring-wine/40 rounded-lg border px-4 py-2 font-serif text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="bg-wine text-parchment hover:bg-wine/90 focus-visible:ring-wine/40 rounded-lg px-4 py-2 font-serif text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
