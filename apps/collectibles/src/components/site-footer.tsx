import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-wine/15 bg-bone/40">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <div className="font-cinzel text-xl font-semibold tracking-[0.18em] text-wine">
            PROVENANCE
            <span className="ml-2 text-[10px] font-medium tracking-[0.32em] text-ink/60">
              COLLECTIBLES
            </span>
          </div>
          <p className="mt-4 max-w-md font-cormorant text-base leading-relaxed text-ink/70">
            An archival-grade registry for the world&apos;s most considered
            collectibles. Every certificate is cryptographically signed and
            independently verifiable.
          </p>
        </div>

        <div>
          <h3 className="font-cinzel text-xs font-semibold tracking-[0.24em] text-ink">
            REGISTRY
          </h3>
          <ul className="mt-4 space-y-2 font-cormorant text-base text-ink/70">
            <li>
              <Link href="/browse" className="hover:text-wine">
                Browse the registry
              </Link>
            </li>
            <li>
              <Link href="/verify" className="hover:text-wine">
                Verify a certificate
              </Link>
            </li>
            <li>
              <Link href="/my" className="hover:text-wine">
                My collection
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-cinzel text-xs font-semibold tracking-[0.24em] text-ink">
            PROVENANCE
          </h3>
          <ul className="mt-4 space-y-2 font-cormorant text-base text-ink/70">
            <li>
              <Link href="/about" className="hover:text-wine">
                About the registry
              </Link>
            </li>
            <li>
              <Link href="/grading" className="hover:text-wine">
                Grading partners
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-wine">
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-wine/10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-ink/50 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p className="font-cinzel tracking-[0.18em]">
            © {new Date().getFullYear()} PROVENANCE
          </p>
          <p className="font-cormorant text-sm italic text-ink/60">
            Authenticate. Verify. Preserve.
          </p>
        </div>
      </div>
    </footer>
  );
}
