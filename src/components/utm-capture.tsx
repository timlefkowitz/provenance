'use client';

import { useEffect } from 'react';

const UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

const COOKIE_KEY = 'pv_utm';
const COOKIE_TTL_DAYS = 30;

type UtmData = Partial<Record<(typeof UTM_PARAMS)[number], string>>;

function parseUtmFromUrl(): UtmData {
  const params = new URLSearchParams(window.location.search);
  const data: UtmData = {};
  for (const key of UTM_PARAMS) {
    const val = params.get(key);
    if (val) data[key] = val;
  }
  return data;
}

function storeUtmCookie(data: UtmData): void {
  const expires = new Date();
  expires.setDate(expires.getDate() + COOKIE_TTL_DAYS);
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(data))};path=/;expires=${expires.toUTCString()};SameSite=Lax`;
}

export function readStoredUtm(): UtmData | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1] ?? ''));
  } catch {
    return null;
  }
}

function pushToDataLayer(data: UtmData): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'utm_captured', ...data });
  console.log('[UTM] pushed to dataLayer', data);
}

/**
 * Captures UTM params from the landing URL and stores them in a first-party
 * cookie so they survive the OAuth redirect flow. On every page load the
 * stored params are re-pushed into window.dataLayer so GTM variables are
 * populated before any subsequent conversion events fire.
 *
 * Must be a Client Component; mount it once in the root layout.
 */
export function UtmCapture() {
  useEffect(() => {
    const fromUrl = parseUtmFromUrl();
    const hasUtmInUrl = Object.keys(fromUrl).length > 0;

    if (hasUtmInUrl) {
      console.log('[UTM] captured from URL, storing in cookie', fromUrl);
      storeUtmCookie(fromUrl);
    }

    const active = hasUtmInUrl ? fromUrl : readStoredUtm();
    if (active && Object.keys(active).length > 0) {
      pushToDataLayer(active);
    }
  }, []);

  return null;
}
