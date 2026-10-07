'use client';

import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Trash2 } from 'lucide-react';
import type { PasskeyListItem } from '@supabase/supabase-js';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';

import { isNativePlatform } from '~/lib/capacitor/is-native';
import {
  isPasskeyCancellation,
  passkeyErrorMessage,
  passkeysEnabledOnServer,
  passkeysSupportedOnDevice,
} from '~/lib/auth/passkeys';

type Availability = 'checking' | 'available' | 'update-app' | 'hidden';

function formatDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
}

export function PasskeysCard() {
  const supabase = useSupabase();
  const [availability, setAvailability] = useState<Availability>('checking');
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.auth.passkey.list();
    if (err) {
      console.error('[Settings/Passkeys] list failed', err);
      setError('Couldn’t load your passkeys.');
      return;
    }
    setPasskeys(data ?? []);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [serverOk, deviceOk] = await Promise.all([passkeysEnabledOnServer(), passkeysSupportedOnDevice()]);
      if (cancelled) return;
      if (!serverOk) return setAvailability('hidden');
      if (deviceOk) {
        setAvailability('available');
        void load();
        return;
      }
      // Passkeys are on, but this iOS build predates the domain association.
      setAvailability(isNativePlatform() ? 'update-app' : 'hidden');
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function addPasskey() {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.registerPasskey();
    setBusy(false);
    if (err) {
      if (!isPasskeyCancellation(err)) {
        console.error('[Settings/Passkeys] register failed', err);
        setError(passkeyErrorMessage(err));
      }
      return;
    }
    console.log('[Settings/Passkeys] passkey added');
    void load();
  }

  async function removePasskey(passkey: PasskeyListItem) {
    if (!window.confirm(`Remove “${passkey.friendly_name || 'Passkey'}”? You won’t be able to sign in with it anymore.`)) return;
    setError(null);
    const { error: err } = await supabase.auth.passkey.delete({ passkeyId: passkey.id });
    if (err) {
      console.error('[Settings/Passkeys] delete failed', err);
      setError('Couldn’t remove that passkey. Please try again.');
      return;
    }
    setPasskeys((current) => current.filter((p) => p.id !== passkey.id));
  }

  if (availability === 'checking' || availability === 'hidden') return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5 text-wine" />
          <CardTitle className="text-base font-display">Passkeys</CardTitle>
        </div>
        <CardDescription className="font-serif text-sm">
          Sign in with Face ID, Touch ID or your device passcode instead of a password. Passkeys sync
          across your devices with iCloud Keychain or your password manager.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {availability === 'update-app' ? (
          <p className="font-serif text-sm text-ink/70">
            Update Provenance from the App Store to use passkeys in the app.
          </p>
        ) : (
          <>
            {passkeys.length > 0 && (
              <ul className="divide-y divide-wine/10 rounded-md border border-wine/15">
                {passkeys.map((passkey) => (
                  <li key={passkey.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-serif text-sm font-medium">{passkey.friendly_name || 'Passkey'}</p>
                      <p className="text-xs text-ink/60">
                        Added {formatDate(passkey.created_at)}
                        {passkey.last_used_at && ` · Last used ${formatDate(passkey.last_used_at)}`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${passkey.friendly_name || 'passkey'}`}
                      onClick={() => removePasskey(passkey)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={addPasskey}
              className="font-serif border-wine/30 text-wine hover:bg-wine/10"
            >
              {busy ? 'Waiting for passkey…' : passkeys.length ? 'Add another passkey' : 'Add a passkey'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
