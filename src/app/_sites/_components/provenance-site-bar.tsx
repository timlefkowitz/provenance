import Link from 'next/link';

const MAIN_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://provenance.guru';

/**
 * Slim Provenance branding bar shown on free-tier creator sites.
 * Sits above the template content without overlapping hero sections.
 */
export function ProvenanceSiteBar() {
  return (
    <div
      className="relative z-50 border-b border-black/8 bg-[#F5F1E8]"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link
          href={MAIN_SITE_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-[#4A2F25] transition-opacity hover:opacity-75"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
            Provenance
          </span>
        </Link>

        <Link
          href={`${MAIN_SITE_URL}/auth/sign-up`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-[#4A2F25]/20 bg-white/70 px-3 py-1 text-[11px] font-medium text-[#4A2F25] transition-colors hover:border-[#4A2F25]/40 hover:bg-white"
        >
          Create your own site — free
        </Link>
      </div>
    </div>
  );
}

/**
 * Footer attribution for free-tier creator sites.
 */
export function PoweredByProvenanceFooter() {
  return (
    <div className="border-t border-black/5 py-4 text-center">
      <a
        href={MAIN_SITE_URL}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-black/30 transition-colors hover:text-black/50"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        Powered by Provenance
      </a>
    </div>
  );
}
