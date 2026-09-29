const CERTIFICATE_PATH = /^\/(artworks|collectibles)\/[0-9a-f-]{36}\/certificate\/?$/i;

function isProvenanceHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'provenance.guru' || host.endsWith('.provenance.guru');
}

/**
 * Maps a scanned QR value to the in-app path to open, or null when it isn't a
 * Provenance code. Certificate links get ?scan=true so the scan is recorded
 * exactly like a camera-app scan of the printed code.
 */
export function certificatePathFromScan(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !isProvenanceHost(url.hostname)) return null;

  if (CERTIFICATE_PATH.test(url.pathname)) {
    url.searchParams.set('scan', 'true');
  }
  return `${url.pathname}${url.search}`;
}
