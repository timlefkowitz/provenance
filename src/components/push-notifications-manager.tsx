'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import { registerPushDevice, unregisterPushDevice } from '~/app/_actions/push-devices';

const TOKEN_KEY = 'pv_push_token';
const DISMISSED_KEY = 'pv_push_prompt_dismissed_at';
const REASK_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable; worst case we ask or register again next launch
  }
}

/**
 * iOS push notifications, tied to whoever is signed in on this device.
 *
 * Signed in + permission granted → register with APNs every launch (tokens
 * can rotate) and store the token against the user. Permission not yet asked
 * → show a short explanation first and only trigger the system prompt when
 * the user taps "Turn on" (guideline 4.5.4: push is opt-in and never needed
 * to use the app). Signed out → drop this device's token so the previous
 * user's notifications stop arriving here.
 */
export function PushNotificationsManager({ userId }: { userId: string | null }) {
  const router = useRouter();
  const [showPrompt, setShowPrompt] = useState(false);

  // Listeners: token registration and notification taps.
  useEffect(() => {
    if (!isNativePlatform() || !userId) return;

    let cancelled = false;
    const handles: { remove: () => Promise<void> }[] = [];

    async function setup() {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      handles.push(
        await PushNotifications.addListener('registration', async ({ value }) => {
          writeStorage(TOKEN_KEY, value);
          const result = await registerPushDevice(value);
          if (!result.success) console.error('[Push] registerPushDevice failed', result.error);
        }),
        await PushNotifications.addListener('registrationError', (err) => {
          console.error('[Push] APNs registration failed', err);
        }),
        await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
          const path = (notification.data as { path?: unknown } | undefined)?.path;
          router.push(typeof path === 'string' && path.startsWith('/') ? path : '/notifications');
        }),
      );

      if (cancelled) {
        handles.forEach((h) => void h.remove());
        return;
      }

      const { receive } = await PushNotifications.checkPermissions();
      if (receive === 'granted') {
        await PushNotifications.register();
      } else if (receive === 'prompt' || receive === 'prompt-with-rationale') {
        const dismissedAt = Number(readStorage(DISMISSED_KEY) ?? 0);
        if (!cancelled && Date.now() - dismissedAt > REASK_AFTER_MS) setShowPrompt(true);
      }
    }

    void setup().catch((err) => console.error('[Push] setup failed', err));

    return () => {
      cancelled = true;
      handles.forEach((h) => void h.remove());
    };
  }, [userId, router]);

  // Signed out: stop sending this device the previous user's notifications.
  useEffect(() => {
    if (!isNativePlatform() || userId) return;
    const token = readStorage(TOKEN_KEY);
    if (!token) return;
    writeStorage(TOKEN_KEY, null);
    void unregisterPushDevice(token);
  }, [userId]);

  async function handleEnable() {
    setShowPrompt(false);
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const { receive } = await PushNotifications.requestPermissions();
      console.log('[Push] permission result', receive);
      if (receive === 'granted') await PushNotifications.register();
    } catch (err) {
      console.error('[Push] requestPermissions failed', err);
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
    writeStorage(DISMISSED_KEY, String(Date.now()));
  }

  if (!showPrompt) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="push-prompt-title"
      // Sits just above the native tab bar.
      style={{ bottom: 'calc(var(--tabbar-h, 0px) + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      className="fixed inset-x-4 z-[94] rounded-xl border border-wine/20 bg-parchment p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-wine/10 p-2 shrink-0">
          <Bell className="h-5 w-5 text-wine" aria-hidden />
        </div>
        <div className="min-w-0">
          <p id="push-prompt-title" className="font-serif text-base text-wine">
            Turn on notifications?
          </p>
          <p className="mt-1 text-sm text-ink/70">
            Know when someone scans your certificate, claims or favorites an artwork, or sends a
            request that needs your answer.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleDismiss}>
          Not now
        </Button>
        <Button size="sm" className="bg-wine text-parchment hover:bg-wine/90" onClick={handleEnable}>
          Turn on
        </Button>
      </div>
    </div>
  );
}
