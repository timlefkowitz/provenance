import Link from "next/link";

const NAV_LINKS = [
  { href: "/browse", label: "Browse" },
  { href: "/my", label: "Collection" },
  { href: "/verify", label: "Verify" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-wine/15 bg-parchment/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-baseline gap-2 sm:gap-3"
          aria-label="Provenance Collectibles home"
        >
          <span className="font-cinzel text-base sm:text-lg font-semibold tracking-[0.18em] text-wine transition-colors group-hover:text-ink">
            PROVENANCE
          </span>
          <span
            aria-hidden="true"
            className="hidden h-3 w-px bg-wine/30 sm:block"
          />
          <span className="hidden font-cinzel text-[11px] font-medium tracking-[0.32em] text-ink/60 sm:inline">
            COLLECTIBLES
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="flex items-center gap-1 text-sm sm:gap-2"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 font-cormorant text-base text-ink/70 transition-colors hover:bg-wine/5 hover:text-ink sm:px-4"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
