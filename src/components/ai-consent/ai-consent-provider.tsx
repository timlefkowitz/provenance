'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
import { useLegalModalOptional } from '~/components/legal/legal-modal-context';
import { getAiConsentStatus, setAiConsent } from '~/app/_actions/ai-consent';

type AiConsentContextValue = {
  /**
   * Resolves true when the user has (or now gives) permission to send their
   * data to our AI provider. Call before any AI request; bail out on false.
   */
  ensureAiConsent: () => Promise<boolean>;
  /** Forget the cached answer (e.g. after the user withdraws in Settings). */
  resetAiConsentCache: () => void;
};

const AiConsentContext = createContext<AiConsentContextValue | null>(null);

export function AiConsentProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consentedRef = useRef(false);
  const pendingRef = useRef<((granted: boolean) => void) | null>(null);
  const legal = useLegalModalOptional();

  const settle = useCallback((granted: boolean) => {
    pendingRef.current?.(granted);
    pendingRef.current = null;
    setOpen(false);
    setError(null);
  }, []);

  const ensureAiConsent = useCallback(async () => {
    if (consentedRef.current) return true;
    try {
      const status = await getAiConsentStatus();
      // Signed-out callers can't use AI features anyway; let the endpoint's
      // own auth check respond.
      if (!status.signedIn || status.consented) {
        consentedRef.current = status.consented;
        return true;
      }
    } catch (err) {
      console.error('[AiConsent] status check failed', err);
    }
    // Only one prompt at a time; a second caller shares the first answer.
    return new Promise<boolean>((resolve) => {
      const previous = pendingRef.current;
      pendingRef.current = (granted) => {
        previous?.(granted);
        resolve(granted);
      };
      setOpen(true);
    });
  }, []);

  const resetAiConsentCache = useCallback(() => {
    consentedRef.current = false;
  }, []);

  async function handleAllow() {
    setSaving(true);
    setError(null);
    const result = await setAiConsent(true);
    setSaving(false);
    if (!result.success) {
      setError('Could not save your choice. Please try again.');
      return;
    }
    consentedRef.current = true;
    settle(true);
  }

  return (
    <AiConsentContext.Provider value={{ ensureAiConsent, resetAiConsentCache }}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !next && !saving && settle(false)}>
        <DialogContent className="sm:max-w-lg font-serif">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-wine flex items-center gap-2">
              <Sparkles className="h-5 w-5" aria-hidden />
              Allow AI features?
            </DialogTitle>
            <DialogDescription className="font-serif text-ink/70">
              This feature uses AI provided by a third party, OpenAI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-ink/80">
            <p>
              To answer you, we send the information this feature needs to <strong>OpenAI</strong>. Depending
              on the feature, that can include your messages, profile details (name, medium, location, bio),
              uploaded CVs or checklists, and details of your artworks and collection.
            </p>
            <p>
              OpenAI processes it only to return a response to us. It does not use data sent through its
              API to train its models. We never share your payment details or password.
            </p>
            <p>
              You can withdraw permission at any time in <strong>Settings → Privacy</strong>. Without it,
              AI features stay off and the rest of Provenance works as normal.
            </p>
            {legal && (
              <button
                type="button"
                className="text-wine underline hover:no-underline"
                onClick={() => legal.openLegalDocument('privacy')}
              >
                Read our Privacy Policy
              </button>
            )}
            {error && <p className="text-red-700" role="alert">{error}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="font-serif" disabled={saving} onClick={() => settle(false)}>
              Not now
            </Button>
            <Button className="font-serif bg-wine text-parchment hover:bg-wine/90" disabled={saving} onClick={handleAllow}>
              Allow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AiConsentContext.Provider>
  );
}

export function useAiConsent(): AiConsentContextValue {
  const ctx = useContext(AiConsentContext);
  if (!ctx) throw new Error('useAiConsent must be used within AiConsentProvider');
  return ctx;
}
