import { Capacitor } from '@capacitor/core';
import { hasNativeNfcPlugin, NativeNfc } from '~/lib/capacitor/nfc';

/**
 * Writing links to NFC tags.
 *
 * - iPhone app: Core NFC through the native Nfc plugin (system "Ready to Scan" sheet).
 * - Chrome on Android: Web NFC (`NDEFReader`).
 * - Everything else (desktop, Safari on iPhone, older app builds) can't write tags.
 */

export type NfcSupport =
  | { kind: 'native' }
  | { kind: 'web' }
  | { kind: 'none'; reason: 'old-app' | 'ios-browser' | 'unsupported-browser' };

export type NfcWriteResult =
  | { status: 'written'; locked: boolean }
  | { status: 'cancelled' };

// Web NFC isn't in TypeScript's DOM lib yet.
type NdefRecordInit = { recordType: string; data?: string };
type NdefWriteOptions = { overwrite?: boolean; signal?: AbortSignal };
interface NdefReaderLike {
  write(message: { records: NdefRecordInit[] }, options?: NdefWriteOptions): Promise<void>;
  makeReadOnly?(options?: { signal?: AbortSignal }): Promise<void>;
}
type NdefReaderCtor = new () => NdefReaderLike;

function webNdefReader(): NdefReaderCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { NDEFReader?: NdefReaderCtor }).NDEFReader;
  return typeof ctor === 'function' ? ctor : null;
}

function isIosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function detectNfcSupport(): NfcSupport {
  if (hasNativeNfcPlugin()) return { kind: 'native' };
  try {
    if (Capacitor.isNativePlatform()) return { kind: 'none', reason: 'old-app' };
  } catch {
    // Not in the app.
  }
  if (webNdefReader()) return { kind: 'web' };
  return { kind: 'none', reason: isIosBrowser() ? 'ios-browser' : 'unsupported-browser' };
}

/** What to tell someone whose device can't write tags. */
export function nfcUnsupportedMessage(reason: Extract<NfcSupport, { kind: 'none' }>['reason']): string {
  switch (reason) {
    case 'old-app':
      return 'Update the Provenance app to write NFC tags.';
    case 'ios-browser':
      return 'Safari can’t write NFC tags. Open this page in the Provenance iPhone app to write the tag.';
    default:
      return 'This browser can’t write NFC tags. Use the Provenance iPhone app or Chrome on an Android phone.';
  }
}

// URI record prefix codes (NFC Forum URI RTD). Writers abbreviate the longest match.
const URI_PREFIXES = ['https://www.', 'http://www.', 'https://', 'http://'];

/**
 * Bytes the link takes on a tag: NDEF message with one short URI record,
 * inside the TLV wrapper. Used to warn before a write when the link won't fit.
 */
export function ndefUrlBytes(url: string): number {
  const prefix = URI_PREFIXES.find((p) => url.startsWith(p)) ?? '';
  const rest = new TextEncoder().encode(url.slice(prefix.length)).length;
  const payload = 1 + rest; // prefix code + URI
  const record = 3 + 1 + payload; // header, type length, payload length (short record), type "U"
  const tlv = record < 255 ? 2 : 4;
  return record + tlv + 1; // + terminator TLV
}

/** Common sticker chips and their usable NDEF space. */
export const NFC_TAG_CAPACITIES = [
  { name: 'NTAG213', bytes: 144 },
  { name: 'NTAG215', bytes: 504 },
  { name: 'NTAG216', bytes: 888 },
] as const;

/** The smallest common chip the link fits on, or null if it fits none. */
export function smallestTagFor(url: string): (typeof NFC_TAG_CAPACITIES)[number] | null {
  const bytes = ndefUrlBytes(url);
  return NFC_TAG_CAPACITIES.find((t) => bytes <= t.bytes) ?? null;
}

export function isWritableUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export class NfcWriteError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'NfcWriteError';
  }
}

/**
 * Writes `url` to the next tag held to the phone. Resolves `cancelled` when the
 * person dismisses the sheet (iOS) or the `signal` aborts (Android).
 * Throws NfcWriteError with a readable message on failure.
 */
export async function writeNfcUrl(
  url: string,
  options: { lock?: boolean; prompt?: string; signal?: AbortSignal } = {},
): Promise<NfcWriteResult> {
  if (!isWritableUrl(url)) throw new NfcWriteError('Enter a full link starting with https://', 'INVALID_URL');
  const support = detectNfcSupport();

  if (support.kind === 'native') {
    try {
      return await NativeNfc.writeUrl({ url, lock: options.lock ?? false, prompt: options.prompt });
    } catch (err) {
      const e = err as { message?: string; code?: string };
      throw new NfcWriteError(e?.message || 'Could not write the tag.', e?.code);
    }
  }

  if (support.kind === 'web') {
    const Reader = webNdefReader()!;
    const reader = new Reader();
    try {
      await reader.write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true, signal: options.signal });
      if (options.lock) {
        if (!reader.makeReadOnly) {
          throw new NfcWriteError('The link was written, but this browser can’t lock tags.', 'LOCK_UNSUPPORTED');
        }
        await reader.makeReadOnly({ signal: options.signal });
      }
      return { status: 'written', locked: !!options.lock };
    } catch (err) {
      if (err instanceof NfcWriteError) throw err;
      const name = (err as DOMException)?.name;
      if (name === 'AbortError') return { status: 'cancelled' };
      if (name === 'NotAllowedError') {
        throw new NfcWriteError('NFC permission was denied. Allow NFC for this site and try again.', name);
      }
      if (name === 'NotSupportedError') {
        throw new NfcWriteError('NFC is turned off or not available. Turn on NFC in Android settings.', name);
      }
      throw new NfcWriteError((err as Error)?.message || 'Could not write the tag.', name);
    }
  }

  throw new NfcWriteError(nfcUnsupportedMessage(support.reason), 'UNSUPPORTED');
}
