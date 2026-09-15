'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import { isStandalonePWA } from '~/lib/app-mode';
import { StoreKit } from '~/lib/capacitor/storekit';
import { APPLE_PRODUCT_TO_PLAN } from '~/lib/capacitor/apple-iap-config';
import { syncAppleEntitlement } from '~/app/subscription/_actions/sync-apple-entitlement';

type Props = {
  userId: string | null;
};

/**
 * Initializes native-only SDKs and applies native CSS when running inside the
 * Provenance Capacitor iOS shell. Safe no-op in any browser.
 */
export function NativeInit({ userId: _userId }: Props) {
  const router = useRouter();

  // ── Universal Links ───────────────────────────────────────────────────────
  // iOS opens the app (instead of Safari) for any tapped https://www.provenance.guru
  // link once Associated Domains is configured (see ios/App/App/App.entitlements).
  // That only launches/foregrounds the app and loads the configured server.url
  // home page though — it doesn't navigate the already-running WebView to the
  // tapped path. appUrlOpen fires with that original URL so we can route there
  // ourselves (covers magic links, email confirmations, shared artwork/profile
  // links, etc.).
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cancelled = false;
    let removeListener: (() => void) | null = null;

    async function setup() {
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('appUrlOpen', ({ url }) => {
        try {
          const target = new URL(url);
          router.push(`${target.pathname}${target.search}`);
        } catch (err) {
          console.error('[NativeInit] appUrlOpen handling failed', { url, err });
        }
      });

      if (cancelled) {
        handle.remove();
        return;
      }
      removeListener = () => handle.remove();
    }

    void setup();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [router]);

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

  // ── Apple IAP reconciliation ───────────────────────────────────────────────
  //
  // StoreKit 2 needs no SDK configuration or login/logout lifecycle. On launch,
  // walk current entitlements and re-sync any that match our products — this
  // self-heals the case where an eager sync after purchase() never reached our
  // server (app killed mid-purchase, transient network failure). StoreKit's
  // local transaction store is independent of whether our upsert succeeded, so
  // this reliably catches up every time the app opens.
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cancelled = false;

    async function reconcile() {
      try {
        const { transactions } = await StoreKit.getCurrentEntitlements();
        for (const t of transactions) {
          if (cancelled) return;
          if (!APPLE_PRODUCT_TO_PLAN[t.productId]) continue;
          const result = await syncAppleEntitlement(t.jwsRepresentation, t.productId);
          if (!result.success) {
            console.error('[NativeInit] Launch-time entitlement sync failed', { productId: t.productId, error: result.error });
          }
        }
      } catch (err) {
        console.error('[NativeInit] Launch-time entitlement reconciliation failed', err);
      }
    }

    void reconcile();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Apple IAP out-of-band updates ─────────────────────────────────────────
  //
  // StoreKit fires 'transactionsUpdated' for transactions that complete while
  // we're not waiting on a purchase() call in progress — Ask to Buy approvals,
  // or a renewal that lands while the app happens to be open. Without this,
  // those only get picked up by the webhook or the next app launch, so the
  // UI can look stale for a signed-in session that's been open a while.
  useEffect(() => {
    if (!isNativePlatform()) return;

    let removeListener: (() => void) | null = null;
    let cancelled = false;

    async function setup() {
      const handle = await StoreKit.addListener('transactionsUpdated', async (transaction) => {
        if (!APPLE_PRODUCT_TO_PLAN[transaction.productId]) return;
        const result = await syncAppleEntitlement(transaction.jwsRepresentation, transaction.productId);
        if (!result.success) {
          console.error('[NativeInit] transactionsUpdated sync failed', { productId: transaction.productId, error: result.error });
          return;
        }
        router.refresh();
      });

      if (cancelled) {
        handle.remove();
        return;
      }
      removeListener = () => handle.remove();
    }

    void setup();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [router]);

  return null;
}
