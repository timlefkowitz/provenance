'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { detectNfcSupport, NfcWriteError, writeNfcUrl, type NfcSupport } from './nfc-writer';

export type NfcWritePhase =
  | { phase: 'idle' }
  | { phase: 'waiting'; key: string }
  | { phase: 'written'; key: string; locked: boolean }
  | { phase: 'error'; key: string; message: string };

/**
 * NFC writing for a component: what this device supports, the current write's
 * state, and write / cancel. `key` identifies which item a write is for, so a
 * batch list can show state per row.
 */
export function useNfcWriter() {
  // Detected after mount: it depends on window and the Capacitor bridge.
  const [support, setSupport] = useState<NfcSupport | null>(null);
  const [state, setState] = useState<NfcWritePhase>({ phase: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSupport(detectNfcSupport());
    return () => abortRef.current?.abort();
  }, []);

  const write = useCallback(
    async (url: string, options: { key?: string; lock?: boolean; prompt?: string } = {}): Promise<boolean> => {
      const key = options.key ?? url;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ phase: 'waiting', key });
      console.log('[NFC] write start', { key, lock: !!options.lock, kind: detectNfcSupport().kind });
      try {
        const result = await writeNfcUrl(url, { lock: options.lock, prompt: options.prompt, signal: controller.signal });
        if (abortRef.current !== controller) return false;
        if (result.status === 'cancelled') {
          console.log('[NFC] write cancelled', { key });
          setState({ phase: 'idle' });
          return false;
        }
        console.log('[NFC] write done', { key, locked: result.locked });
        setState({ phase: 'written', key, locked: result.locked });
        return true;
      } catch (err) {
        if (abortRef.current !== controller) return false;
        const message = err instanceof NfcWriteError ? err.message : 'Could not write the tag.';
        console.error('[NFC] write failed', { key, err });
        setState({ phase: 'error', key, message });
        return false;
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ phase: 'idle' });
  }, []);

  const reset = useCallback(() => setState({ phase: 'idle' }), []);

  return { support, state, write, cancel, reset };
}
