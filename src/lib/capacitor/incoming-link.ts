/**
 * Universal links (a scanned QR code, a tapped link in Mail or Messages) that
 * open the iOS app.
 *
 * iOS hands the link to the app, and Capacitor normally re-emits it to the
 * page as an `appUrlOpen` event. That event can be lost: on a cold launch in
 * older native builds it fires before the page is listening, and when iOS has
 * killed the WebView in the background, it goes to the page that is being
 * replaced. The link is still available from `App.getLaunchUrl()`, so the app
 * also reads it on load, and every link is followed once.
 */

const HANDLED_KEY = 'pv_incoming_link_handled';

function isProvenanceHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'provenance.guru' || host.endsWith('.provenance.guru');
}

/** In-app path for an https Provenance link, or null for anything else. */
export function incomingLinkPath(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !isProvenanceHost(url.hostname)) return null;
  return `${url.pathname}${url.search}`;
}

function handledLinks(): string[] {
  try {
    const raw = sessionStorage.getItem(HANDLED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Records the link as followed. Returns false when it was already followed in
 * this WebView session, so a page reload (or an `/auth/*` full navigation)
 * can't replay the same launch link.
 */
export function claimIncomingLink(rawUrl: string): boolean {
  const handled = handledLinks();
  if (handled.includes(rawUrl)) return false;
  try {
    sessionStorage.setItem(HANDLED_KEY, JSON.stringify([...handled.slice(-19), rawUrl]));
  } catch {
    // Storage unavailable — follow the link anyway.
  }
  return true;
}
