'use server';

import { cookies } from 'next/headers';

import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE,
  type CookieConsent,
  parseCookieConsent,
} from '~/lib/cookie-consent';

export async function saveCookieConsent(consent: CookieConsent): Promise<void> {
  const value = parseCookieConsent(consent);
  if (!value) return;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_CONSENT_COOKIE, value, {
    path: '/',
    maxAge: COOKIE_CONSENT_MAX_AGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
