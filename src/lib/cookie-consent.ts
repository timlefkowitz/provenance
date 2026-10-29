/**
 * Cookie-consent choice, mirrored into a server-set cookie. Safari/WebKit ITP
 * wipes localStorage (and caps JS-written cookies at 7 days) for sites the user
 * hasn't interacted with lately, so localStorage alone made the banner come
 * back. A cookie set via an HTTP response isn't capped, and the root layout can
 * read it to skip rendering the banner entirely.
 */
export const COOKIE_CONSENT_COOKIE = 'pv_cookie_consent';
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export type CookieConsent = 'granted' | 'denied';

export function parseCookieConsent(value: string | undefined | null): CookieConsent | null {
  return value === 'granted' || value === 'denied' ? value : null;
}
