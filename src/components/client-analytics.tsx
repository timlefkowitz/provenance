'use client';

import { useSyncExternalStore } from 'react';

import dynamic from 'next/dynamic';

import { isNativePlatform } from '~/lib/capacitor/is-native';

const Analytics = dynamic(
  () => import('@vercel/analytics/next').then((m) => m.Analytics),
  { ssr: false },
);
const subscribeToPlatform = () => () => undefined;

export function ClientAnalytics() {
  // Do not initialize Vercel Analytics inside the iOS wrapper. This keeps the
  // App Store build free of cross-site analytics/tracking SDKs.
  const shouldLoad = useSyncExternalStore(
    subscribeToPlatform,
    () => !isNativePlatform(),
    () => false,
  );

  return shouldLoad ? <Analytics /> : null;
}
