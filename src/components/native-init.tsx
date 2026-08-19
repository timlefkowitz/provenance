'use client';

import { useEffect } from 'react';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import { isStandalonePWA } from '~/lib/app-mode';
import { getRevenueCatApiKeyIOS } from '~/lib/capacitor/revenuecat-config';

type Props = {
  userId: string | null;
};

/**
 * Initializes native-only SDKs and applies native CSS when running inside the
 * Provenance Capacitor iOS shell. Safe no-op in any browser.
 */
export function NativeInit({ userId }: Props) {
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

  useEffect(() => {
    if (!isNativePlatform() || !userId) return;

    const apiKey = getRevenueCatApiKeyIOS();
    if (!apiKey) {
      console.error('[NativeInit] NEXT_PUBLIC_REVENUECAT_API_KEY_IOS is not set');
      return;
    }

    async function initRevenueCat() {
      try {
        const { Purchases } = await import('@revenuecat/purchases-capacitor');
        await Purchases.configure({ apiKey, appUserID: userId! });
        console.log('[NativeInit] RevenueCat configured', { userId });
      } catch (err) {
        console.error('[NativeInit] RevenueCat configure failed', err);
      }
    }

    void initRevenueCat();
  }, [userId]);

  return null;
}
