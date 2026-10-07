'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Fingerprint } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import { isPasskeyCancellation, passkeyErrorMessage, passkeysSupported } from '~/lib/auth/passkeys';

/** "Not now" hides the prompt on this device for this long. */
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
/** Let the page (and any banners) settle before interrupting. */
const SHOW_DELAY_MS = 1500;
/** Mid-flow pages where a modal would get in the way. */
const SKIP_PATH_PREFIXES = ['/auth', '/onboarding', '/update-password', '/subscription', '/claim'];

function snoozeKey(userId: string) {
  return `pv_passkey_prompt_snoozed_until:${userId}`;
}

function isSnoozed(userId: string): boolean {
  try {
    return Number(localStorage.getItem(snoozeKey(userId)) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

function snooze(userId: string) {
  try {
    localStorage.setItem(snoozeKey(userId), String(Date.now() + SNOOZE_MS));
  } catch {
    // Storage blocked — the prompt may show again next session, which is fine.
  }
}

/**
 * Offers signed-in users without a passkey to add one. Checked once per user
 * per page load (the root layout doesn't remount on client navigation), so in
 * practice it appears right after signing in. Silent wherever passkeys can't
 * be used (see passkeysSupported).
 */
export function PasskeyPrompt({ userId }: { userId: string | null }) {
  const supabase = useSupabase();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || checkedFor.current === userId || isSnoozed(userId)) return;
    if (SKIP_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;
    // Brand-new accounts are about to go through onboarding — ask another time.
    if (new URLSearchParams(window.location.search).has('new_user')) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      checkedFor.current = userId;
      if (!(await passkeysSupported()) || cancelled) return;
      const { data, error: err } = await supabase.auth.passkey.list();
      if (cancelled) return;
      if (err) {
        console.error('[PasskeyPrompt] passkey list failed', err);
        return;
      }
      if (data && data.length === 0) {
        console.log('[PasskeyPrompt] offering passkey');
        setOpen(true);
      }
    }, SHOW_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Re-evaluated on navigation so a sign-in that lands via client routing
    // (still on /auth/… when userId appears) is caught on the next page;
    // checkedFor keeps it to one check per user per page load.
  }, [userId, pathname, supabase]);

  function dismiss() {
    if (userId && !added) snooze(userId);
    setOpen(false);
  }

  async function addPasskey() {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.registerPasskey();
    setBusy(false);
    if (err) {
      if (!isPasskeyCancellation(err)) {
        console.error('[PasskeyPrompt] register failed', err);
        setError(passkeyErrorMessage(err));
      }
      return;
    }
    console.log('[PasskeyPrompt] passkey added');
    setAdded(true);
  }

  if (!userId) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="sm:max-w-md">
        {added ? (
          <>
            <DialogHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
              </div>
              <DialogTitle className="font-display">Passkey added</DialogTitle>
              <DialogDescription className="font-serif">
                Next time, just choose “Sign in with a passkey”. You can manage passkeys in Settings → Security.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-wine/10">
                <Fingerprint className="h-5 w-5 text-wine" aria-hidden />
              </div>
              <DialogTitle className="font-display">Sign in faster with a passkey</DialogTitle>
              <DialogDescription className="font-serif">
                Use Face ID, Touch ID or your device passcode next time — no password or email link needed.
                Your passkey is saved to iCloud Keychain or your password manager, so it works on your other
                devices too.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={dismiss} disabled={busy}>
                Not now
              </Button>
              <Button type="button" onClick={addPasskey} disabled={busy}>
                {busy ? 'Waiting for passkey…' : 'Add a passkey'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
