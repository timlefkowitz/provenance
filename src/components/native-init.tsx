'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import { isStandalonePWA } from '~/lib/app-mode';
import {
  canResumeLaunchRoute,
  claimLaunchNavigation,
  saveResumeRoute,
  takeLaunchResumeRoute,
} from '~/lib/capacitor/resume-route';
import { NATIVE_PLATFORM_COOKIE } from '~/lib/capacitor/native-platform-cookie';
import { handleNativeAuthCallbackUrl, nativeOAuthHandler } from '~/lib/capacitor/native-oauth';
import { claimIncomingLink, incomingLinkPath } from '~/lib/capacitor/incoming-link';
import { setNativeOAuthHandler } from '@kit/supabase/native-oauth';
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
  const pathname = usePathname();

  // ── Universal Links ───────────────────────────────────────────────────────
  // iOS opens the app (instead of Safari) for any tapped https://www.provenance.guru
  // link once Associated Domains is configured (see ios/App/App/App.entitlements).
  // That only launches/foregrounds the app and loads the configured server.url
  // home page though — it doesn't navigate the already-running WebView to the
  // tapped path. appUrlOpen fires with that original URL so we can route there
  // ourselves (covers magic links, email confirmations, shared artwork/profile
  // links, scanned exhibition and certificate QR codes, etc.).
  //
  // appUrlOpen can be lost (see incoming-link.ts), which left scanned QR codes
  // on the landing page. So the launch URL is also read on load and followed
  // once.
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cancelled = false;
    let removeListener: (() => void) | null = null;

    // Google and Apple sign-in use system sheets on native (see native-oauth.ts).
    setNativeOAuthHandler(nativeOAuthHandler);

    const currentPath = () => `${window.location.pathname}${window.location.search}`;
    // Links the launch-URL check below just followed, so the same link's
    // appUrlOpen (newer native builds deliver both) doesn't navigate twice —
    // which would replay a one-time /auth/* token.
    const followedAtLaunch = new Map<string, number>();

    const goTo = (path: string) => {
      claimLaunchNavigation();
      // /auth/* are route handlers that set the session cookie and
      // redirect — they need a real navigation, not a client transition.
      if (path.startsWith('/auth/')) {
        window.location.assign(path);
      } else {
        router.push(path);
      }
    };

    async function setup() {
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('appUrlOpen', async ({ url }) => {
        try {
          const target = new URL(url);
          claimLaunchNavigation();
          if (await handleNativeAuthCallbackUrl(target)) return;

          const path = `${target.pathname}${target.search}`;
          // An explicit open always navigates (the same QR can be scanned
          // twice), unless the launch-URL check below just took us there.
          const followedAt = followedAtLaunch.get(url);
          followedAtLaunch.delete(url);
          if (followedAt !== undefined && Date.now() - followedAt < 10_000) return;
          claimIncomingLink(url);
          console.log('[NativeInit] appUrlOpen', { path });
          goTo(path);
        } catch (err) {
          console.error('[NativeInit] appUrlOpen handling failed', { url, err });
        }
      });

      if (cancelled) {
        handle.remove();
        return;
      }
      removeListener = () => handle.remove();

      // Fallback for a lost appUrlOpen: follow the link iOS launched us with.
      // Only https Provenance links — the custom-scheme auth callback is
      // one-time and handled solely by appUrlOpen above.
      try {
        const launch = await App.getLaunchUrl();
        const path = launch?.url ? incomingLinkPath(launch.url) : null;
        if (cancelled || !launch?.url || !path) return;
        if (!claimIncomingLink(launch.url)) return;
        if (currentPath() === path) return;
        console.log('[NativeInit] following launch URL', { path });
        followedAtLaunch.set(launch.url, Date.now());
        goTo(path);
      } catch (err) {
        console.error('[NativeInit] launch URL check failed', err);
      }
    }

    void setup();

    return () => {
      cancelled = true;
      removeListener?.();
      setNativeOAuthHandler(null);
    };
  }, [router]);

  // ── Resume where the user left off ────────────────────────────────────────
  // iOS often reclaims the WebView while the user is in another app, so the
  // next open is a cold launch onto the landing page. Remember the current
  // route (on every navigation and when backgrounding, which also catches
  // query-only changes) and reopen it on launch. The AppSplash overlay covers
  // the brief landing page underneath.
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cancelled = false;
    let removeListener: (() => void) | null = null;
    const launchPath = `${window.location.pathname}${window.location.search}`;
    const resumePath = takeLaunchResumeRoute(launchPath);

    async function setup() {
      const { App } = await import('@capacitor/app');

      if (resumePath) {
        // A universal link launch wins over the remembered route.
        const launch = await App.getLaunchUrl().catch(() => undefined);
        const stillOnLaunchPage =
          `${window.location.pathname}${window.location.search}` === launchPath;
        // Not gated on `cancelled`: the restore is claimed once per launch,
        // and this lives in the root layout, so only a dev double-mount
        // cleans up before it resolves.
        if (!launch?.url && canResumeLaunchRoute() && stillOnLaunchPage) {
          router.replace(resumePath);
        }
      }

      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) saveResumeRoute(`${window.location.pathname}${window.location.search}`);
      });
      if (cancelled) handle.remove();
      else removeListener = () => handle.remove();
    }

    void setup();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [router]);

  // Declared after the launch restore so its first run can't overwrite the
  // remembered route before it is read.
  useEffect(() => {
    if (!isNativePlatform()) return;
    saveResumeRoute(`${window.location.pathname}${window.location.search}`);
  }, [pathname]);

  // ── Shell / PWA setup ─────────────────────────────────────────────────────
  useEffect(() => {
    const native = isNativePlatform();
    const standalone = isStandalonePWA();

    if (!native && !standalone) return;

    // Prevent pinch-to-zoom and input-focus zoom — feels like a native app, not
    // a browser. The server already sends this once the platform cookie is set;
    // this covers the very first launch. maximum-scale=5 must go too, or iOS
    // still zooms on focus. React can re-render the tag, so re-apply on change.
    const lockScale = () => {
      const meta = document.querySelector('meta[name="viewport"]');
      if (!meta) return;
      const current = meta.getAttribute('content') ?? '';
      if (current.includes('maximum-scale=1') && current.includes('user-scalable=no')) return;
      const kept = current
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part && !/^(maximum-scale|user-scalable)\s*=/i.test(part));
      meta.setAttribute('content', [...kept, 'maximum-scale=1', 'user-scalable=no'].join(', '));
    };
    lockScale();
    const viewportObserver = new MutationObserver(lockScale);
    viewportObserver.observe(document.head, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['content'],
    });

    if (standalone && !native) {
      // Mark <html> for CSS so standalone-PWA shell rules apply.
      document.documentElement.classList.add('pwa-standalone');
      console.log('[NativeInit] Running as standalone PWA');
      return () => viewportObserver.disconnect();
    }

    // Mark <html> so CSS can target native-only rules.
    document.documentElement.classList.add('cap-native');

    // Let server routes (sign-up trial provisioning) know this is the iOS app:
    // there, the free trial is Apple's introductory offer, not a server trial.
    document.cookie = `${NATIVE_PLATFORM_COOKIE}=ios; path=/; max-age=31536000; SameSite=Lax; Secure`;

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

    return () => viewportObserver.disconnect();
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
