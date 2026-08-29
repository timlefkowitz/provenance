'use client';

import { useEffect } from 'react';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import { isStandalonePWA } from '~/lib/app-mode';
import { getRevenueCatApiKeyIOS } from '~/lib/capacitor/revenuecat-config';
import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';

type Props = {
  userId: string | null;
};

/**
 * Initializes native-only SDKs and applies native CSS when running inside the
 * Provenance Capacitor iOS shell. Safe no-op in any browser.
 */
export function NativeInit({ userId: _userId }: Props) {
  // ── Shell / PWA setup ─────────────────────────────────────────────────────
  useEffect(() => {
    const native = isNativePlatform();
    const standalone = isStandalonePWA();

    if (!native && !standalone) return;

    // Prevent pinch-to-zoom — feels like a native app, not a browser.
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      const current = meta.getAttribute('content') ?? '';
      if (!current.includes('user-scalable')) {
        meta.setAttribute('content', current + ', user-scalable=no');
      }
    }

    if (standalone && !native) {
      // Mark <html> for CSS so standalone-PWA shell rules apply.
      document.documentElement.classList.add('pwa-standalone');
      console.log('[NativeInit] Running as standalone PWA');
      return;
    }

    // Mark <html> so CSS can target native-only rules.
    document.documentElement.classList.add('cap-native');

    async function initNative() {
      try {
        // Hide splash screen once the web content is ready.
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide({ fadeOutDuration: 300 });
        console.log('[NativeInit] SplashScreen hidden');
      } catch (err) {
        console.error('[NativeInit] SplashScreen hide failed', err);
      }

      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#F8F4F0' });
        console.log('[NativeInit] StatusBar configured');
      } catch (err) {
        console.error('[NativeInit] StatusBar configure failed', err);
      }
    }

    void initNative();
  }, []);

  // ── RevenueCat — configure once, then track auth state ───────────────────
  //
  // RevenueCat must be configured before any purchase call. We configure with
  // the public iOS key immediately and then use Supabase onAuthStateChange to
  // call logIn/logOut as the user signs in or out — including after email sign-
  // in where the root Server Component may not remount to pass a new userId prop.
  useEffect(() => {
    if (!isNativePlatform()) return;

    const apiKey = getRevenueCatApiKeyIOS();
    if (!apiKey) {
      console.error('[NativeInit] NEXT_PUBLIC_REVENUECAT_API_KEY_IOS is not set');
      return;
    }

    let unsubscribeAuth: (() => void) | null = null;
    let cancelled = false;

    async function init() {
      try {
        const { Purchases } = await import('@revenuecat/purchases-capacitor');

        // Configure the SDK (idempotent). No appUserID here — logIn below
        // associates the purchase record with the signed-in Supabase user.
        await Purchases.configure({ apiKey });
        console.log('[NativeInit] RevenueCat configured');

        if (cancelled) return;

        const supabase = getSupabaseBrowserClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            try {
              if (session?.user && event !== 'SIGNED_OUT') {
                // Associate (or re-associate) RevenueCat with the current user.
                await Purchases.logIn({ appUserID: session.user.id });
                console.log('[NativeInit] RevenueCat logged in', { userId: session.user.id, event });
              } else if (event === 'SIGNED_OUT') {
                // Revert to anonymous RevenueCat ID so a new user starts clean.
                await Purchases.logOut();
                console.log('[NativeInit] RevenueCat logged out');
              }
            } catch (err) {
              // logOut throws when no user is logged in to RC — that is fine.
              console.error('[NativeInit] RevenueCat auth change handler failed', { event, err });
            }
          },
        );

        unsubscribeAuth = () => subscription.unsubscribe();
      } catch (err) {
        console.error('[NativeInit] RevenueCat configure failed', err);
      }
    }

    void init();

    return () => {
      cancelled = true;
      unsubscribeAuth?.();
    };
  }, []);

  return null;
}
