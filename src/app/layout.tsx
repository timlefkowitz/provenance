import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, Libre_Caslon_Text } from "next/font/google";
import "./globals.css";

import { Toaster } from "@kit/ui/sonner";
import { RootProviders } from "~/components/root-providers";
import { OnboardingGuard } from "~/components/onboarding-guard";
import { Navigation } from "~/components/navigation";
import { RoleSelectionModal } from "~/components/role-selection-modal";
import { GalleryProfileNotification } from "~/components/gallery-profile-notification";
import { Analytics } from "@vercel/analytics/next";
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
  const i18n = await createI18nServerInstance();
  const currentLang = i18n.language || 'en';

  return (
    <html lang={currentLang} suppressHydrationWarning>
      <body
        className={`${cinzel.variable} ${cormorant.variable} ${caslon.variable} antialiased bg-parchment text-ink`}
      >
        <RootProviders lang={currentLang}>
          <OnboardingGuard>
            <Navigation />
            <GalleryProfileNotification />
            {children}
            <RoleSelectionModal />
          </OnboardingGuard>
        </RootProviders>
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  );
}
