/**
 * Link routing rules for the app shell (Capacitor wrapper / installed PWA).
 *
 * A Capacitor WKWebView cannot open new windows, so any `target="_blank"` or
 * `window.open()` gets handed to the system browser — which ejects the user
 * into Safari, complete with an address bar. For our own pages that is always
 * wrong: they should stay inside the app.
 *
 * Genuinely off-domain destinations (Stripe checkout, social share dialogs,
 * press articles) are left to the system browser, which is the correct place
 * for them.
 */

/** Hosts belonging to Provenance — these must never leave the app shell. */
const INTERNAL_HOST_SUFFIX = 'provenance.guru';

/**
 * Returns true when the URL points at one of our own pages and should
 * therefore be navigated inside the webview rather than opened externally.
 */
export function isInternalUrl(rawHref: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const url = new URL(rawHref, window.location.href);

    // Only http(s) can be navigated in-webview. mailto:/tel:/sms:/blob: and
    // friends must be handed to the OS.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    // Same origin as the page we're on (covers preview deploys and localhost).
    if (url.origin === window.location.origin) return true;

    // Any provenance.guru host: apex, www, and per-artist subdomains.
    const host = url.hostname.toLowerCase();
    return host === INTERNAL_HOST_SUFFIX || host.endsWith(`.${INTERNAL_HOST_SUFFIX}`);
  } catch {
    return false;
  }
}

/**
 * Splits an internal URL into the path Next.js's router can push, or null when
 * the URL lives on a different Provenance host and needs a full page load.
 */
export function toRouterPath(rawHref: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const url = new URL(rawHref, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
