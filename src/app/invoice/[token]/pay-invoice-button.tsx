'use client';

import { useState } from 'react';

import { Loader2 } from 'lucide-react';

import { toast } from '@kit/ui/sonner';

import { isNativePlatform } from '~/lib/capacitor/is-native';
import { openExternalCheckout, reloadAfterCheckout } from '~/lib/capacitor/open-external-checkout';

export function PayInvoiceButton({ token }: { token: string }) {
  const [paying, setPaying] = useState(false);

  async function pay() {
    setPaying(true);
    try {
      const res = await fetch('/api/stripe/create-invoice-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, app: isNativePlatform() }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (data.url) {
        await openExternalCheckout(data.url, { onClose: reloadAfterCheckout });
        if (!isNativePlatform()) return;
      } else {
        toast.error(data.error ?? 'Could not start checkout. Please try again.');
      }
    } catch (err) {
      console.error('[Invoice] pay failed', err);
      toast.error('Could not start checkout. Please try again.');
    }
    setPaying(false);
  }

  return (
    <button
      type="button"
      onClick={pay}
      disabled={paying}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-editorial-ink px-4 py-3 font-jetbrains text-[11px] uppercase tracking-[0.14em] text-bone transition-colors hover:bg-vermillion disabled:opacity-60"
    >
      {paying && <Loader2 className="h-4 w-4 animate-spin" />}
      Pay invoice
    </button>
  );
}
