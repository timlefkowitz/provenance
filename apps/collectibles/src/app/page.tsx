import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileSignature, ShieldCheck, ScrollText } from "lucide-react";
import { CategoryGrid } from "~/components/category-grid";
import { VerifyForm } from "~/components/verify-form";
import { FeaturedPieces } from "~/components/featured-pieces";

const TRUST_MARKS = [
  "PSA",
  "CGC",
  "BGS",
  "PCGS",
  "NGC",
  "SGC",
  "GIA",
  "Sotheby's",
  "Christie's",
];

const STEPS = [
  {
    icon: FileSignature,
    label: "Register",
    copy: "Submit photographs, grading reports and ownership history. Each submission is reviewed and assigned a unique cryptographic certificate.",
  },
  {
    icon: ShieldCheck,
    label: "Authenticate",
    copy: "Independent grading partners and our verification engine confirm condition, attribution and chain-of-custody before issuance.",
  },
  {
    icon: ScrollText,
    label: "Preserve",
    copy: "Every transfer is signed and recorded — building a tamper-evident provenance record that travels with the piece for life.",
  },
];

export default function CollectiblesHome() {
  return (
    <main className="min-h-viewport">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-7 lg:pr-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-wine/20 bg-bone/60 px-3 py-1 font-cinzel text-[10px] font-medium tracking-[0.28em] text-wine">
              <span className="h-1 w-1 rounded-full bg-gold" aria-hidden="true" />
              ARCHIVAL REGISTRY · EST. 2025
            </span>

            <h1 className="mt-8 font-cinzel text-5xl font-semibold leading-[1.05] tracking-tight text-ink text-balance sm:text-6xl lg:text-7xl">
              The provenance of every
              <span className="block italic text-wine">considered thing.</span>
            </h1>

            <p className="mt-6 max-w-xl font-cormorant text-xl leading-relaxed text-ink/70 text-pretty sm:text-2xl">
              An archival-grade registry for coins, cards, watches, memorabilia
              and the world&apos;s most cherished collectibles. Verify
              authenticity. Trace ownership. Preserve history.
            </p>

            <div className="mt-10 max-w-xl">
              <VerifyForm variant="hero" id="hero-verify" />
              <p className="mt-3 pl-2 font-cormorant text-sm italic text-ink/55">
                Try a sample certificate, or{" "}
                <Link href="/browse" className="text-wine underline-offset-4 hover:underline">
                  browse the registry
                </Link>
                .
              </p>
            </div>

            <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-wine/15 pt-8">
              <div>
                <dt className="font-cinzel text-[10px] font-medium tracking-[0.24em] text-ink/50">
                  AUTHENTICATED
                </dt>
                <dd className="mt-2 font-cinzel text-2xl font-semibold text-ink sm:text-3xl">
                  18,112
                </dd>
              </div>
              <div>
                <dt className="font-cinzel text-[10px] font-medium tracking-[0.24em] text-ink/50">
                  CATEGORIES
                </dt>
                <dd className="mt-2 font-cinzel text-2xl font-semibold text-ink sm:text-3xl">
                  11
                </dd>
              </div>
              <div>
                <dt className="font-cinzel text-[10px] font-medium tracking-[0.24em] text-ink/50">
                  COUNTRIES
                </dt>
                <dd className="mt-2 font-cinzel text-2xl font-semibold text-ink sm:text-3xl">
                  47
                </dd>
              </div>
            </dl>
          </div>

          <div className="lg:col-span-5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-wine/20 shadow-[0_30px_60px_-30px_rgba(74,47,37,0.45)]">
              <Image
                src="/images/hero-collectibles.jpg"
                alt="Curated still life of a vintage pocket watch, gold coin, graded card and fountain pen on aged parchment"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/30 via-transparent to-transparent" />

              {/* Certificate ribbon */}
              <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-parchment/30 bg-ink/55 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
                      <span className="font-cinzel text-[10px] font-medium tracking-[0.28em] text-parchment/90">
                        CERTIFIED · PROVENANCE
                      </span>
                    </div>
                    <p className="mt-1 font-cinzel text-base font-semibold tracking-wide text-parchment">
                      Aureus of Augustus
                    </p>
                    <p className="font-cormorant text-sm italic text-parchment/70">
                      27 BC – 14 AD · NGC Choice XF
                    </p>
                  </div>
                  <span className="font-mono text-[10px] tracking-wider text-parchment/60">
                    PRV-9C2F-0418
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust marquee */}
        <div className="border-y border-wine/15 bg-bone/40">
          <div
            className="flex overflow-hidden py-6"
            role="list"
            aria-label="Grading and authentication partners"
          >
            <div className="flex shrink-0 animate-drift items-center gap-12 pr-12 sm:gap-16 sm:pr-16">
              {[...TRUST_MARKS, ...TRUST_MARKS].map((mark, i) => (
                <span
                  key={`${mark}-${i}`}
                  role="listitem"
                  className="font-cinzel text-sm font-medium tracking-[0.32em] text-ink/50"
                >
                  {mark}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="flex flex-col items-baseline justify-between gap-4 sm:flex-row sm:gap-8">
          <div>
            <span className="font-cinzel text-[10px] font-medium tracking-[0.28em] text-wine">
              CURATED · THIS WEEK
            </span>
            <h2 className="mt-3 font-cinzel text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Recently authenticated.
            </h2>
          </div>
          <Link
            href="/browse"
            className="group inline-flex items-center gap-2 font-cinzel text-xs font-medium tracking-[0.24em] text-wine hover:text-ink"
          >
            VIEW ALL
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </Link>
        </div>

        <div className="mt-12">
          <FeaturedPieces />
        </div>
      </section>

      {/* CATEGORIES */}
      <section
        id="categories"
        className="border-t border-wine/15 bg-bone/30"
      >
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="font-cinzel text-[10px] font-medium tracking-[0.28em] text-wine">
              THE REGISTRY
            </span>
            <h2 className="mt-3 font-cinzel text-3xl font-semibold tracking-tight text-ink sm:text-4xl text-balance">
              Eleven categories. One archival standard.
            </h2>
            <p className="mt-4 font-cormorant text-lg leading-relaxed text-ink/65 text-pretty">
              Whether numismatic, horological or sentimental, each piece is
              registered to the same exacting standard of authenticity.
            </p>
          </div>

          <div className="mt-14">
            <CategoryGrid />
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <span className="font-cinzel text-[10px] font-medium tracking-[0.28em] text-wine">
              HOW IT WORKS
            </span>
            <h2 className="mt-3 font-cinzel text-3xl font-semibold tracking-tight text-ink sm:text-4xl text-balance">
              From submission to permanent record.
            </h2>
            <p className="mt-4 font-cormorant text-lg leading-relaxed text-ink/65 text-pretty">
              Every certificate is cryptographically signed and independently
              verifiable — designed to outlast platforms, marketplaces, and
              owners.
            </p>
          </div>

          <ol className="lg:col-span-8 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-wine/15 bg-wine/15 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.label}
                className="flex flex-col gap-5 bg-parchment p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-wine/25 text-wine">
                    <step.icon className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <span className="font-cinzel text-[10px] font-medium tracking-[0.24em] text-ink/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-cinzel text-lg font-semibold tracking-wide text-ink">
                  {step.label}
                </h3>
                <p className="font-cormorant text-base leading-relaxed text-ink/65">
                  {step.copy}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* VERIFY CTA */}
      <section className="border-t border-wine/15">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="relative overflow-hidden rounded-3xl border border-wine/20 bg-ink p-10 sm:p-14 lg:p-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-wine/30 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-gold/15 blur-3xl"
            />

            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-parchment/20 px-3 py-1 font-cinzel text-[10px] font-medium tracking-[0.28em] text-parchment/80">
                <ShieldCheck className="h-3 w-3 text-gold" strokeWidth={2} />
                INSTANT VERIFICATION
              </span>

              <h2 className="mt-6 font-cinzel text-4xl font-semibold leading-tight tracking-tight text-parchment sm:text-5xl text-balance">
                Verify any Provenance certificate.
              </h2>
              <p className="mt-4 font-cormorant text-lg leading-relaxed text-parchment/70 text-pretty">
                Enter the certificate number from any registered piece. We will
                return its complete chain of custody, grading, and supporting
                documentation in seconds.
              </p>

              <div className="mt-8 [&_form]:bg-parchment/10 [&_form]:border-parchment/25 [&_input]:text-parchment [&_input]:placeholder:text-parchment/40 [&_svg]:text-parchment/60 [&_button]:bg-parchment [&_button]:text-ink [&_button:hover]:bg-gold [&_button:hover]:text-ink">
                <VerifyForm variant="hero" id="cta-verify" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
