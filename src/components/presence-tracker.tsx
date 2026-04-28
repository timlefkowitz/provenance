'use client';

import { useEffect, useRef } from 'react';
import { useCurrentUser } from '~/hooks/use-current-user';

const HEARTBEAT_INTERVAL_MS = 60_000;
// Don't fire a ping unless at least this much time has passed since the
// last one — guards against effect double-runs in dev (StrictMode) and
// rapid visibility flips.
const MIN_GAP_MS = 45_000;

/**
 * Mounted once in the root layout. Sends a single, debounced heartbeat
 * to /api/heartbeat every minute the tab is visible. Used to power
 * "currently online" and "total active hours" admin analytics.
 *
 * No-op for unauthenticated users.
 */
export function PresenceTracker() {
  const user = useCurrentUser();
  const userId = user.data?.id ?? null;
  const lastPingRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function ping() {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      const now = Date.now();
      if (now - lastPingRef.current < MIN_GAP_MS) {
        return;
      }
      lastPingRef.current = now;
      try {
        await fetch('/api/heartbeat', { method: 'POST', keepalive: true });
      } catch (err) {
        // Swallow — presence is best-effort.
        console.error('[Presence] heartbeat failed', err);
      }
    }

    // First ping shortly after mount, then on a steady cadence.
    const initialTimeout = setTimeout(ping, 1_500);
    intervalRef.current = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    function onVisible() {
      if (document.visibilityState === 'visible') {
        void ping();
      }
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  return null;
}
