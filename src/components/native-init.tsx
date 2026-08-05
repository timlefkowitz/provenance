'use client';

import { useEffect } from 'react';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import { getRevenueCatApiKeyIOS } from '~/lib/capacitor/revenuecat-config';

type Props = {
  userId: string | null;
};

/**
 * Initializes native-only SDKs (RevenueCat) when running inside the
 * Provenance Capacitor iOS shell. Safe no-op in any browser.
 *
 * Must be rendered client-side with the authenticated user's ID so RevenueCat
 * can tie the subscriber to our Supabase user_id (used as app_user_id).
 */
export function NativeInit({ userId }: Props) {
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
