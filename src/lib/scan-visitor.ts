const KEY = 'pv_scan_visitor';

/**
 * Anonymous id for this browser, sent with certificate scans so the owner can
 * see how many different people scanned a code. Random, not tied to an
 * account or device, and kept only in this browser's storage. Returns null
 * when storage is unavailable (the scan is still recorded, just not de-duplicated).
 */
export function getScanVisitorId(): string | null {
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && /^[a-z0-9]{16,40}$/.test(existing)) return existing;
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    return null;
  }
}
