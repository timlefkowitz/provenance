'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Fingerprint } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';

import {
  isPasskeyCancellation,
  isPasskeyChallengeExpired,
  passkeyAutofillSupported,
  passkeyErrorMessage,
  passkeysSupported,
} from '~/lib/auth/passkeys';

/** Same-origin, single-leading-slash paths only (CWE-601). */
function safeNextPath(next: string | null, fallback: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}

/**
 * "Sign in with a passkey" button, plus passkey suggestions in the keyboard
 * autofill bar (Conditional UI) on fields marked `autocomplete="username webauthn"`.
 * Renders nothing where passkeys can't work (old browsers, iOS app builds < 9).
 */
export function PasskeySignIn({ homePath }: { homePath: string }) {
  const supabase = useSupabase();
  const nextPath = safeNextPath(useSearchParams().get('next'), homePath);

  const [supported, setSupported] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autofillAbort = useRef<AbortController | null>(null);

  const onSignedIn = useCallback(() => {
    console.log('[Auth/Passkey] signed in');
    // Full load so server components pick up the new session cookie.
    window.location.assign(nextPath);
  }, [nextPath]);

  const startAutofill = useCallback(async () => {
    autofillAbort.current?.abort();
    const controller = new AbortController();
    autofillAbort.current = controller;

    // The autofill prompt can outlive its 5-minute server challenge; when the
    // user then picks a passkey, verification fails and we ask again.
    for (;;) {
      const { error: err } = await supabase.auth.signInWithPasskey({
        options: { mediation: 'conditional', signal: controller.signal },
      });

      if (controller.signal.aborted) return;
      if (!err) return onSignedIn();
      if (isPasskeyChallengeExpired(err)) continue;
      if (!isPasskeyCancellation(err)) {
        console.error('[Auth/Passkey] autofill sign-in failed', err);
        setError(passkeyErrorMessage(err));
      }
      return;
    }
  }, [supabase, onSignedIn]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!(await passkeysSupported()) || cancelled) return;
      setSupported(true);
      if (await passkeyAutofillSupported() && !cancelled) void startAutofill();
    })();

    return () => {
      cancelled = true;
      autofillAbort.current?.abort();
    };
  }, [startAutofill]);

  async function onClick() {
    setError(null);
    setPending(true);
    // Only one WebAuthn request may be pending at a time.
    autofillAbort.current?.abort();

    const { error: err } = await supabase.auth.signInWithPasskey();

    if (!err) return onSignedIn();

    setPending(false);
    if (!isPasskeyCancellation(err)) {
      console.error('[Auth/Passkey] sign-in failed', err);
      setError(passkeyErrorMessage(err));
    }
    if (await passkeyAutofillSupported()) void startAutofill();
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" className="w-full gap-2" disabled={pending} onClick={onClick}>
        <Fingerprint className="h-4 w-4" aria-hidden />
        {pending ? 'Waiting for passkey…' : 'Sign in with a passkey'}
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
