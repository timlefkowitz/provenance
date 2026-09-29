'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import { Biometric, biometryLabel, type BiometryType } from '~/lib/capacitor/biometric';
import { APP_LOCK_GRACE_MS, isAppLockEnabled } from '~/lib/capacitor/app-lock';

/**
 * Face ID lock screen for the iOS app. When the user has turned on App Lock
 * (Settings → Security), the app is covered on launch and after more than a
 * minute in the background until Face ID (or the device passcode) succeeds.
 */
export function AppLock({ userId }: { userId: string | null }) {
  const [locked, setLocked] = useState(false);
  const [biometryType, setBiometryType] = useState<BiometryType>('faceID');
  const authenticatingRef = useRef(false);
  const backgroundedAtRef = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (authenticatingRef.current) return;
    authenticatingRef.current = true;
    try {
      const { success } = await Biometric.authenticate({ reason: 'Unlock your Provenance collection' });
      if (success) setLocked(false);
    } catch (err) {
      console.error('[AppLock] authenticate failed', err);
    } finally {
      authenticatingRef.current = false;
    }
  }, []);

  // Lock on launch.
  useEffect(() => {
    if (!isNativePlatform() || !userId || !isAppLockEnabled()) return;
    setLocked(true);
    void Biometric.getStatus()
      .then(({ biometryType: type }) => setBiometryType(type))
      .catch(() => undefined);
    void unlock();
  }, [userId, unlock]);

  // Re-lock after time in the background.
  useEffect(() => {
    if (!isNativePlatform() || !userId) return;

    let removeListener: (() => void) | null = null;
    let cancelled = false;

    async function setup() {
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isAppLockEnabled()) return;
        if (!isActive) {
          backgroundedAtRef.current = Date.now();
          return;
        }
        const away = backgroundedAtRef.current ? Date.now() - backgroundedAtRef.current : 0;
        backgroundedAtRef.current = null;
        if (away > APP_LOCK_GRACE_MS) {
          setLocked(true);
          void unlock();
        }
      });
      if (cancelled) handle.remove();
      else removeListener = () => handle.remove();
    }

    void setup();
    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [userId, unlock]);

  if (!locked) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-lock-title"
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-6 bg-parchment px-8 text-center"
    >
      <div className="rounded-full bg-wine/10 p-5">
        <Lock className="h-8 w-8 text-wine" aria-hidden />
      </div>
      <div>
        <h1 id="app-lock-title" className="font-display text-2xl text-wine">
          Provenance is locked
        </h1>
        <p className="mt-2 font-serif text-sm text-ink/70">
          Use {biometryLabel(biometryType)} to open your collection.
        </p>
      </div>
      <Button className="bg-wine text-parchment hover:bg-wine/90 font-serif" onClick={() => void unlock()}>
        Unlock
      </Button>
    </div>
  );
}
