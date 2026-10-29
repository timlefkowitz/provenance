'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { useLegalModal } from '~/components/legal/legal-modal-context';
import { saveCookieConsent } from '~/app/_actions/cookie-consent';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import { type CookieConsent, parseCookieConsent } from '~/lib/cookie-consent';
import { gtmService } from '~/lib/gtm';

const CONSENT_KEY = 'provenance_cookie_consent';
const subscribeToPlatform = () => () => undefined;

function getStoredConsent(): StoredConsent | null {
  try {
    return parseCookieConsent(localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
}

type StoredConsent = CookieConsent;

function persistConsent(consent: StoredConsent) {
  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    // Storage blocked (private mode) — the server cookie still records it.
  }
  saveCookieConsent(consent).catch((err) => {
    console.error('[GTM] Could not save cookie consent', err);
  });
}

/**
 * EU-compliant cookie consent banner.
 *
 * - The choice is persisted to localStorage and to a long-lived server-set
 *   cookie. The root layout reads that cookie (and the native-app cookie) and
 *   passes them in, so the banner never shows — not even for a frame during
 *   hydration — once a choice exists (localStorage alone gets wiped by Safari ITP).
 * - On "Accept": updates Consent Mode v2 to 'granted' and persists the choice.
 * - On "Decline": updates Consent Mode v2 to 'denied' and persists the choice.
 * - Re-applies stored consent on every page load so GTM tags honour prior choice.
 * - In native Capacitor mode: analytics and advertising scripts are not loaded;
 *   the app therefore has no cookie-consent state to grant.
 */
export function CookieConsentBanner({
  initialConsent = null,
  isNativeApp = false,
}: {
  initialConsent?: StoredConsent | null;
  isNativeApp?: boolean;
}) {
  const { openLegalDocument } = useLegalModal();
  const [selectedConsent, setSelectedConsent] = useState<StoredConsent | null>(
    null,
  );
  const detectedNative = useSyncExternalStore(
    subscribeToPlatform,
    isNativePlatform,
    () => isNativeApp,
  );
  const nativePlatform = isNativeApp || detectedNative;
  const localConsent = useSyncExternalStore(
    subscribeToPlatform,
    getStoredConsent,
    () => initialConsent,
  );
  const storedConsent = initialConsent ?? localConsent;

  useEffect(() => {
    // Native apps don't show cookie banners. Their tracking scripts are gated
    // out at the component level, so do not grant Consent Mode here.
    if (nativePlatform) return;

    if (storedConsent === 'granted') {
      gtmService.grantConsent();
    } else if (storedConsent === 'denied') {
      gtmService.denyConsent();
    }

    // Choice made before the server cookie existed: copy it over so the
    // server knows about it on the next load.
    if (storedConsent && !initialConsent) {
      saveCookieConsent(storedConsent).catch(() => undefined);
    }
  }, [nativePlatform, storedConsent, initialConsent]);

  const handleAccept = () => {
    console.log('[GTM] Cookie consent accepted');
    persistConsent('granted');
    gtmService.grantConsent();
    setSelectedConsent('granted');
  };

  const handleDecline = () => {
    console.log('[GTM] Cookie consent declined');
    persistConsent('denied');
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
