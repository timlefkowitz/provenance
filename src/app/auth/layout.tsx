import { AppLogo } from '~/components/app-logo';

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

function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <div className="flex min-h-screen w-full">
      {/* ── Left hero panel (hidden on mobile) ── */}
      <div
        className="relative hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col"
        style={{ backgroundColor: '#4A2F25' }}
      >
        {/* Decorative corner frames */}
        <span className="pointer-events-none absolute top-7 left-7 h-12 w-12 border-t-2 border-l-2 border-white/20" />
        <span className="pointer-events-none absolute top-7 right-7 h-12 w-12 border-t-2 border-r-2 border-white/20" />
        <span className="pointer-events-none absolute bottom-7 left-7 h-12 w-12 border-b-2 border-l-2 border-white/20" />
        <span className="pointer-events-none absolute bottom-7 right-7 h-12 w-12 border-b-2 border-r-2 border-white/20" />

        {/* Large watermark "P" */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none overflow-hidden">
          <svg
            viewBox="0 0 64 64"
            aria-hidden="true"
            className="h-[70%] w-auto opacity-[0.06]"
          >
            <path
              fill="#F5F1E8"
              d="M24 14h10c7.2 0 12 4.4 12 10.8 0 6.5-4.8 11.1-12 11.1h-5.2V50H24V14Zm9.4 18.1c4 0 6.6-2.4 6.6-6.1 0-3.6-2.6-5.9-6.6-5.9h-4.6v12z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col justify-between px-12 py-14">
          {/* Top: wordmark */}
          <div>
            <span
              className="text-sm font-semibold tracking-[0.35em] uppercase"
              style={{ color: '#F5F1E8', opacity: 0.55 }}
            >
              Provenance
            </span>
          </div>

          {/* Middle: tagline block */}
          <div className="flex flex-col gap-y-8">
            {/* Decorative rule */}
            <span
              className="block h-px w-12"
              style={{ backgroundColor: '#F5F1E8', opacity: 0.3 }}
            />

            <blockquote className="flex flex-col gap-y-4">
              <p
                className="text-2xl xl:text-3xl leading-snug font-light"
                style={{ color: '#F5F1E8' }}
              >
                {quote.text}
              </p>
              {quote.attr && (
                <cite
                  className="not-italic text-sm tracking-wide"
                  style={{ color: '#F5F1E8', opacity: 0.5 }}
                >
                  — {quote.attr}
                </cite>
              )}
            </blockquote>
          </div>

          {/* Bottom: badge */}
          <div className="flex items-center gap-x-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: '#F5F1E8', opacity: 0.4 }}
            />
            <span
              className="text-xs tracking-widest uppercase"
              style={{ color: '#F5F1E8', opacity: 0.35 }}
            >
              Trusted provenance records
            </span>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16"
        style={{ backgroundColor: '#F5F1E8' }}
      >
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center gap-y-3">
          <svg
            viewBox="0 0 64 64"
            aria-hidden="true"
            className="h-10 w-10"
          >
            <rect width="64" height="64" rx="8" fill="#4A2F25" />
            <path
              fill="#F5F1E8"
              d="M24 14h10c7.2 0 12 4.4 12 10.8 0 6.5-4.8 11.1-12 11.1h-5.2V50H24V14Zm9.4 18.1c4 0 6.6-2.4 6.6-6.1 0-3.6-2.6-5.9-6.6-5.9h-4.6v12z"
            />
          </svg>
          <AppLogo />
        </div>

        {/* Card */}
        <div
          className="w-full max-w-sm rounded-2xl px-8 py-10 shadow-sm"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          {children}
        </div>

        {/* Footer note */}
        <div className="mt-8 flex flex-col items-center gap-y-1 text-center">
          <p className="text-xs" style={{ color: '#4A2F25', opacity: 0.5 }}>
            &copy; {new Date().getFullYear()} Provenance. All rights reserved.
          </p>
          <p className="text-[10px]" style={{ color: '#4A2F25', opacity: 0.45 }}>
            By continuing you agree to our{' '}
            <a href="/terms-of-service" className="underline underline-offset-2 hover:opacity-80">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy-policy" className="underline underline-offset-2 hover:opacity-80">
              Privacy Policy
            </a>
            .{' '}
            We use your Google account only for sign-in (email, name, photo).
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
