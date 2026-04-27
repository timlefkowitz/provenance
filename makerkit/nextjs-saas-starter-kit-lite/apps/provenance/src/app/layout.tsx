import type { Metadata, Viewport } from "next";
import { Cinzel, Cormorant_Garamond, Libre_Caslon_Text } from "next/font/google";
import "./globals.css";

import { Toaster } from "@kit/ui/sonner";
import { RootProviders } from "~/components/root-providers";
import { OnboardingGuard } from "~/components/onboarding-guard";
import { Navigation } from "~/components/navigation";
import { RoleSelectionModal } from "~/components/role-selection-modal";
import { IPhoneBottomNav } from "~/components/iphone-bottom-nav";

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
  applicationName: "Provenance",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Provenance",
    // "default" gives a parchment status bar that matches our theme on iPhone.
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/app-icon.jpg",
    shortcut: "/app-icon.jpg",
    apple: "/app-icon.jpg",
  },
};

// `viewportFit: "cover"` is required for `env(safe-area-inset-*)` to resolve
// to non-zero values on iPhones with a notch / home indicator. Without this,
// the bottom tab bar would not respect the home indicator area.
export const viewport: Viewport = {
  themeColor: "#4A2F25",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${cinzel.variable} ${cormorant.variable} ${caslon.variable} antialiased bg-parchment text-ink`}
      >
        <RootProviders lang="en">
          <OnboardingGuard>
            <Navigation />
            {children}
            <RoleSelectionModal />
            {/* Renders only on iPhone / installed PWA. No-op everywhere else. */}
            <IPhoneBottomNav />
          </OnboardingGuard>
        </RootProviders>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
