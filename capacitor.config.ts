import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Provenance iOS native wrapper.
 *
 * Architecture: remote-server mode. The native WKWebView loads the live
 * provenance.guru server rather than a statically-exported bundle.
 * This keeps every Next.js Server Action, API route, and middleware working
 * exactly as on the web — no static-export constraint at all.
 *
 * webDir points at a minimal www/ placeholder that Capacitor needs to exist
 * for `npx cap sync`, but it is never actually served to the user (server.url
 * takes over immediately on launch).
 */
const config: CapacitorConfig = {
  appId: 'com.provenance.app',
  appName: 'Provenance',
  webDir: 'www',

  server: {
    // Use the canonical www host — the apex redirects 307 to www which Capacitor
    // would otherwise hand off to Safari before the first page even loads.
    url: 'https://www.provenance.guru',
    cleartext: false,
    allowNavigation: [
      'provenance.guru',       // apex, for any hard-coded apex links
      '*.provenance.guru',     // www (canonical), auth.provenance.guru, {handle} sites
      '*.supabase.co',         // legacy Supabase auth/storage host
      'checkout.stripe.com',   // artwork, domain, subscription checkout
      'billing.stripe.com',    // billing portal
      'connect.stripe.com',    // Stripe Connect onboarding
    ],
  },

  ios: {
    // Insets the web content below the status bar / Dynamic Island automatically.
    contentInset: 'automatic',
    // Native scheme used for the WKWebView so cookies work correctly.
    scheme: 'Provenance',
    backgroundColor: '#F8F4F0',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#F8F4F0',
      showSpinner: false,
      launchFadeOutDuration: 300,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F8F4F0',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
