'use client';

import { useEffect, useState } from 'react';
import { gtmService } from '~/lib/gtm';

const CONSENT_KEY = 'provenance_cookie_consent';

type StoredConsent = 'granted' | 'denied';

/**
 * EU-compliant cookie consent banner.
 *
 * - Reads prior choice from localStorage on mount to avoid SSR flash.
 * - On "Accept": updates Consent Mode v2 to 'granted' and persists to localStorage.
 * - On "Decline": updates Consent Mode v2 to 'denied' and persists to localStorage.
 * - Re-applies stored consent on every page load so GTM tags honour prior choice.
 */
export function CookieConsentBanner() {
  // 'unresolved' = we haven't yet read localStorage (avoids SSR / hydration flash)
  const [resolved, setResolved] = useState<StoredConsent | 'unresolved'>('unresolved');

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY) as StoredConsent | null;

    if (stored === 'granted') {
      gtmService.grantConsent();
      setResolved('granted');
    } else if (stored === 'denied') {
      gtmService.denyConsent();
      setResolved('denied');
    } else {
      // No prior choice — show the banner
      setResolved('unresolved');
    }
  }, []);

  const handleAccept = () => {
    console.log('[GTM] Cookie consent accepted');
    localStorage.setItem(CONSENT_KEY, 'granted');
    gtmService.grantConsent();
    setResolved('granted');
  };

  const handleDecline = () => {
    console.log('[GTM] Cookie consent declined');
    localStorage.setItem(CONSENT_KEY, 'denied');
    gtmService.denyConsent();
    setResolved('denied');
  };

  // Don't render until we've checked localStorage, and don't render once resolved
  if (resolved !== 'unresolved') return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 inset-x-0 z-50 px-4 pb-4 pointer-events-none"
    >
      <div className="max-w-3xl mx-auto pointer-events-auto bg-parchment/95 backdrop-blur-sm border border-wine/20 rounded-xl shadow-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="flex-1 text-sm font-serif text-ink/80 leading-relaxed">
          We use cookies to measure ad performance and improve your experience.
          By clicking <strong className="text-ink font-semibold">Accept</strong>, you
          consent to our use of advertising and analytics cookies.{' '}
          <a
            href="/about"
            className="text-wine underline underline-offset-2 hover:text-wine/80 transition-colors"
          >
            Learn more
          </a>
          .
        </p>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm font-serif border border-wine/30 text-ink/80 rounded-lg hover:bg-wine/5 hover:border-wine/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm font-serif bg-wine text-parchment rounded-lg hover:bg-wine/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
