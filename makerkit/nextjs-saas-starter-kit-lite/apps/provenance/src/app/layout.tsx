import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, Libre_Caslon_Text } from "next/font/google";
import "./globals.css";

import { Toaster } from "@kit/ui/sonner";
import { RootProviders } from "~/components/root-providers";
import { OnboardingGuard } from "~/components/onboarding-guard";
import { Navigation } from "~/components/navigation";

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
          </OnboardingGuard>
        </RootProviders>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
