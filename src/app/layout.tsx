import type { Metadata } from "next";
import type { JwtPayload } from "@supabase/supabase-js";
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
import { StreakActivityTracker } from "~/components/streak-activity-tracker";
import { createI18nServerInstance } from "~/lib/i18n/i18n.server";

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
  title: "Provenance | A Journal of Art, Objects & Their Histories",
  description: "Verified provenance entries and immutable historical timelines on Avalanche.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
  try {
    const i18n = await createI18nServerInstance();
    currentLang = i18n.language || 'en';

    const client = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError) {
      console.error('[Provenance] RootLayout auth.getUser failed', authError);
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
    <html lang={currentLang} suppressHydrationWarning>
      <body
        className={`${cinzel.variable} ${cormorant.variable} ${caslon.variable} antialiased bg-parchment text-ink overflow-x-hidden`}
      >
        <RootProviders lang={currentLang}>
          <OnboardingGuard>
            <Navigation initialUser={initialUser} />
            <StreakActivityTracker />
            <GalleryProfileNotification />
            {children}
            <RoleSelectionModal />
          </OnboardingGuard>
        </RootProviders>
        {/* bottom-* avoids Sonner’s full-width top layer (z-index ~1e9) covering the sticky nav on mobile */}
        <Toaster richColors position="bottom-center" />
        <ClientAnalytics />
      </body>
    </html>
  );
}
