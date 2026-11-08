const HERO_QUOTES = [
  {
    text: 'Every work of art carries a history. Provenance makes that history undeniable.',
    attr: null,
  },
  {
    text: 'Authenticity is not a luxury — it is the foundation of trust between artist and collector.',
    attr: null,
  },
  {
    text: 'A painting without provenance is like a sentence without a subject.',
    attr: null,
  },
];

const quote = HERO_QUOTES[0];

/*
  Auth shell — same vocabulary as the navbar that sits above it: bone ground,
  Fraunces italic display with a vermillion full stop, JetBrains Mono
  uppercase labels, ink hairlines and square corners. Form controls inside
  are restyled by the `.editorial-auth` rules in globals.css.
*/
function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--nav-h))] w-full bg-bone text-editorial-ink">
      {/* ── Left hero panel (hidden on mobile) ── */}
      <aside className="relative hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col bg-editorial-ink text-bone">
        {/* Hairline inset frame */}
        <span className="pointer-events-none absolute inset-6 border border-bone/15" />

        {/* Large watermark wordmark */}
        <div className="pointer-events-none absolute inset-0 flex items-end justify-start overflow-hidden select-none">
          <span className="display-mega -mb-[0.12em] -ml-[0.04em] text-[16rem] xl:text-[20rem] text-bone/[0.05]">
            P.
          </span>
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-between px-14 py-16">
          {/* Top: section label */}
          <div className="flex items-center gap-3">
            <span className="label-editorial text-gilt">§ Registry</span>
            <span className="h-px w-10 bg-bone/20" />
            <span className="label-editorial text-bone/50">Provenance</span>
          </div>

          {/* Middle: quote */}
          <blockquote className="flex max-w-md flex-col gap-y-6">
            <span className="block h-[1.5px] w-10 bg-vermillion" />
            <p className="font-fraunces italic text-3xl xl:text-4xl font-light leading-[1.15] tracking-tight">
              {quote.text}
            </p>
            {quote.attr && (
              <cite className="label-editorial not-italic text-bone/50">— {quote.attr}</cite>
            )}
          </blockquote>

          {/* Bottom: badge */}
          <div className="flex items-center gap-x-2.5">
            <span className="inline-block h-1.5 w-1.5 bg-vermillion" />
            <span className="label-editorial text-bone/45">Trusted provenance records</span>
          </div>
        </div>
      </aside>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16">
        <div className="editorial-auth w-full max-w-sm border border-editorial-border/15 bg-bone px-7 py-9 shadow-editorial sm:px-8">
          {children}
        </div>

        {/* Footer note */}
        <div className="mt-8 flex max-w-sm flex-col items-center gap-y-2 text-center">
          <p className="label-editorial text-[10px] text-editorial-ink/45">
            &copy; {new Date().getFullYear()} Provenance
          </p>
          <p className="text-[11px] leading-relaxed text-editorial-ink/50">
            By continuing you agree to our{' '}
            <a
              href="/terms-of-service"
              className="underline decoration-editorial-ink/30 underline-offset-2 hover:text-vermillion hover:decoration-vermillion"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="/privacy-policy"
              className="underline decoration-editorial-ink/30 underline-offset-2 hover:text-vermillion hover:decoration-vermillion"
            >
              Privacy Policy
            </a>
            . We use your Google account only for sign-in (email, name, photo).
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
