'use client';

import { useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import { Biometric, biometryLabel, type BiometryType } from '~/lib/capacitor/biometric';
import { isAppLockEnabled, setAppLockEnabled } from '~/lib/capacitor/app-lock';

/** Settings → Security toggle for the Face ID app lock. iOS app only. */
export function AppLockCard() {
  const [status, setStatus] = useState<{ available: boolean; biometryType: BiometryType } | null>(null);
  // The card renders nothing until getStatus resolves, so reading storage
  // here can't cause a hydration mismatch.
  const [enabled, setEnabled] = useState(() => typeof window !== 'undefined' && isAppLockEnabled());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativePlatform()) return;
    Biometric.getStatus()
      .then(setStatus)
      .catch((err) => console.error('[AppLock] getStatus failed', err));
  }, []);

  if (!status) return null;

  const label = biometryLabel(status.biometryType);

  async function handleChange(next: boolean) {
    setError(null);
    // Confirm it works before relying on it, and so nobody else can turn it off.
    const { success } = await Biometric.authenticate({
      reason: next ? `Turn on App Lock with ${label}` : 'Turn off App Lock',
    });
    if (!success) {
      setError(`${label} didn't succeed, so App Lock wasn't changed.`);
      return;
    }
    setAppLockEnabled(next);
    setEnabled(next);
    console.log('[AppLock] setting changed', { enabled: next });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5 text-wine" />
          <CardTitle className="text-base font-display">App Lock</CardTitle>
        </div>
        <CardDescription className="font-serif text-sm">
          Keep your collection private on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <Label htmlFor="app-lock" className="font-serif text-sm text-ink/80 leading-relaxed">
            {status.available
              ? `Require ${label} when Provenance opens or has been in the background for more than a minute.`
              : 'Set up Face ID or a passcode in iOS Settings to use App Lock.'}
          </Label>
          <Switch
            id="app-lock"
            checked={enabled}
            disabled={!status.available}
            onCheckedChange={(v) => void handleChange(v)}
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 font-serif" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
