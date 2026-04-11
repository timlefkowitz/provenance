import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Provenance Collectibles | Authenticate & Track Collectible Items",
  description:
    "Verify, authenticate, and track provenance for coins, cards, memorabilia, and other collectible items.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="parchment" suppressHydrationWarning>
      <body
        className={`${cinzel.variable} ${cormorant.variable} antialiased overflow-x-hidden`}
      >
        <nav className="sticky top-0 z-50 border-b border-wine/20 bg-parchment/95 backdrop-blur supports-[backdrop-filter]:bg-parchment/80">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
            <a href="/" className="font-cinzel text-xl font-bold tracking-wider text-wine">
              PROVENANCE <span className="text-sm font-normal tracking-wide">COLLECTIBLES</span>
            </a>
            <div className="flex items-center gap-6 text-sm">
              <a href="/browse" className="text-ink/70 hover:text-ink transition-colors">Browse</a>
              <a href="/my" className="text-ink/70 hover:text-ink transition-colors">My Items</a>
              <a href="/verify" className="text-ink/70 hover:text-ink transition-colors">Verify</a>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
