'use client';

import { useSyncExternalStore } from 'react';

import Script from 'next/script';

import { isNativePlatform } from '~/lib/capacitor/is-native';

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const subscribeToPlatform = () => () => undefined;

/**
 * Renders Google Tag Manager, Google Ads gtag, and Consent Mode v2 defaults.
 *
 * nonce — the per-request CSP nonce forwarded by middleware via the x-nonce
 * request header. Passing it to every <Script> allows browsers enforcing a
 * nonce-based CSP to execute these inline/external scripts without 'unsafe-inline'.
 *
 * The consent-defaults script is rendered before tag loaders so they all start
 * in the denied state. The scripts run after interactive so the native-shell
 * gate can reliably prevent them from loading.
 *
 * Renders nothing when neither NEXT_PUBLIC_GTM_ID nor NEXT_PUBLIC_GOOGLE_ADS_ID
 * is set (dev / CI environments).
 */
export function GoogleTagManager({ nonce }: { nonce?: string }) {
  // The native iOS shell is intentionally analytics- and ads-free. In
  // particular, it must not load a third-party tag before an ATT authorization
  // flow. The web product continues to use its existing consent controls.
  // Start false so these scripts are absent from the server-rendered HTML too.
  const shouldLoad = useSyncExternalStore(
    subscribeToPlatform,
    () => !isNativePlatform(),
    () => false,
  );

  if (!shouldLoad) return null;
  if (!GTM_ID && !GOOGLE_ADS_ID) return null;

  const adsConfigLine = GOOGLE_ADS_ID
    ? `gtag('config', '${GOOGLE_ADS_ID}');`
    : '';

  return (
    <>
      {/* Consent Mode v2 defaults — must fire before tags so all tags see denied state. */}
      <Script
        id="gtm-consent-defaults"
        strategy="afterInteractive"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('consent', 'default', {
              ad_storage: 'denied',
              analytics_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              wait_for_update: 500
            });
            gtag('js', new Date());
            ${adsConfigLine}
          `,
        }}
      />

      {/* Google Ads gtag.js loader */}
      {GOOGLE_ADS_ID ? (
        <Script
          id="google-ads-gtag"
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="afterInteractive"
          nonce={nonce}
        />
      ) : null}

      {/* GTM container loader */}
      {GTM_ID ? (
        <Script
          id="gtm-loader"
          strategy="afterInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
            (function(w,d,s,l,i){
              w[l]=w[l]||[];
              w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],
                  j=d.createElement(s),
                  dl=l!='dataLayer'?'&l='+l:'';
              j.async=true;
              j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
              f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `,
          }}
        />
      ) : null}

      {/* noscript fallback — place as first child of <body> via layout */}
      {GTM_ID ? (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
      ) : null}
    </>
  );
}
