import type { Metadata, Viewport } from "next";
import type { JwtPayload } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { Cinzel, Cormorant_Garamond, Libre_Caslon_Text } from "next/font/google";
import "./globals.css";

import { Toaster } from "@kit/ui/sonner";
import { getSupabaseServerClient } from "@kit/supabase/server-client";
import { RootProviders } from "~/components/root-providers";
import { OnboardingGuard } from "~/components/onboarding-guard";
import { Navigation } from "~/components/navigation";
import { RoleSelectionModal } from "~/components/role-selection-modal";
import { GalleryProfileNotification } from "~/components/gallery-profile-notification";
import { ClientAnalytics } from "~/components/client-analytics";
import { GoogleTagManager } from "~/components/google-tag-manager";
import { CookieConsentBanner } from "~/components/cookie-consent-banner";
import { LegalModalProvider } from "~/components/legal/legal-modal-context";
import { StreakActivityTracker } from "~/components/streak-activity-tracker";
import { PresenceTracker } from "~/components/presence-tracker";
import { UtmCapture } from "~/components/utm-capture";
import { TrialBanner } from "~/components/trial-banner";
import { TacoBubble } from "~/components/taco-bubble";
import { createI18nServerInstance } from "~/lib/i18n/i18n.server";
import { getPublicSiteOrigin } from "~/lib/seo/public-site-origin";
import { cn } from "@kit/ui/utils";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const caslon = Libre_Caslon_Text({
  variable: "--font-caslon",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteOrigin()),
  title: "Provenance | A Journal of Art, Objects & Their Histories",
  description: "Verified provenance entries and immutable historical timelines on Avalanche.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Provenance",
  },
  formatDetection: {
    telephone: false,
  },
};

// Viewport tuned for the latest mobile devices (iPhone 14/15/16 Pro Dynamic
// Island, iPhone 16/16 Plus/16 Pro Max, Pixel 8/9 Pro, Galaxy S24/S25, foldables).
// `viewportFit: "cover"` allows safe-area-inset-* env() values to take effect so
// the sticky nav and bottom toolbar respect the notch and home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

// Ensure this layout is always rendered dynamically since we access headers/cookies
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get the current language from server-side i18n (reads from cookie)
  // Wrap in try-catch to prevent layout crash on Vercel (e.g. i18n/cookies edge cases)
  let currentLang = 'en';
  let initialUser: JwtPayload | null = null;

  const VALID_THEMES = new Set(['parchment', 'light', 'dark', 'system']);
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('theme')?.value;
  const currentTheme = themeCookie && VALID_THEMES.has(themeCookie) ? themeCookie : 'light';

  // Read the per-request nonce forwarded by middleware so it can be passed to
  // GoogleTagManager (and Next.js will propagate it to its own inline scripts).
  const headerStore = await headers();
  const nonce = headerStore.get('x-nonce') ?? undefined;

  try {
    const i18n = await createI18nServerInstance();
    currentLang = i18n.language || 'en';

    const client = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError) {
      // AuthSessionMissingError is expected for unauthenticated visitors — not a real error.
      if (authError.name !== 'AuthSessionMissingError') {
        console.error('[Provenance] RootLayout auth.getUser failed', authError);
      }
    } else if (user) {
      initialUser = {
        ...user,
        sub: user.id,
      } as unknown as JwtPayload;
    }
  } catch (err) {
    console.error('[Provenance] RootLayout init failed, using safe defaults:', err);
  }

  if (process.env.NEXT_PUBLIC_DEBUG_APP === '1') {
    console.debug('[Provenance] RootLayout render', { currentLang });
  }

  return (
    <html
      lang={currentLang}
      className={cn(currentTheme)}
      suppressHydrationWarning
    >
      <GoogleTagManager nonce={nonce} />
      <body
        className={`${cinzel.variable} ${cormorant.variable} ${caslon.variable} antialiased overflow-x-hidden`}
      >
        <RootProviders lang={currentLang} theme={currentTheme}>
          <LegalModalProvider>
            <OnboardingGuard>
              <Navigation initialUser={initialUser} />
              <TrialBanner />
              <StreakActivityTracker />
              <PresenceTracker />
              <UtmCapture />
              <GalleryProfileNotification />
              {children}
              <RoleSelectionModal />
              <TacoBubble isSignedIn={!!initialUser} />
            </OnboardingGuard>
            <CookieConsentBanner />
          </LegalModalProvider>
        </RootProviders>
        {/* bottom-* avoids Sonner’s full-width top layer (z-index ~1e9) covering the sticky nav on mobile */}
        <Toaster position="bottom-center" />
        <ClientAnalytics />
      </body>
    </html>
  );
}
