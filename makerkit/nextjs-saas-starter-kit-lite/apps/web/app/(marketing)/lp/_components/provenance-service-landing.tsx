import Link from 'next/link';

import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  FileStack,
  Gavel,
  Landmark,
  Minus,
  Quote,
  ScrollText,
  Sparkles,
} from 'lucide-react';

import { AboutReveal } from '@/components/about-reveal';

import pathsConfig from '~/config/paths.config';

import {
  getProvenanceServiceJsonLd,
  PROVENANCE_SERVICE_FAQS,
} from './provenance-service-seo';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-medium tracking-[0.25em] text-wine/70 uppercase">
      {children}
    </span>
  );
}

const researchAreas = [
  { icon: Building2, label: 'Galleries and dealers' },
  { icon: ScrollText, label: 'Artist estates and foundations' },
  { icon: Gavel, label: 'Auction house archives' },
  { icon: Sparkles, label: 'Private collections' },
  { icon: Landmark, label: 'Institutional records' },
];

const riskItems = [
  'Blocks sales at major auction houses',
  'Reduces valuation',
  'Raises legal and authenticity concerns',
];

const benefitItems = [
  'Increases buyer confidence',
  'Unlocks access to top-tier marketplaces',
  'Can materially increase asset value',
];

const processSteps = [
  {
    step: '01',
    title: 'Intake & Assessment',
    body: 'We evaluate your asset and identify provenance gaps.',
  },
  {
    step: '02',
    title: 'Research & Outreach',
    body: 'We contact galleries, archives, and relevant parties globally.',
  },
  {
    step: '03',
    title: 'Documentation & Verification',
    body: 'We compile and validate all findings into a structured record.',
  },
  {
    step: '04',
    title: 'Final Provenance File',
    body: 'You receive a complete, defensible provenance package.',
  },
];

const deliverables = [
  'Chronological ownership history',
  'Supporting documentation (invoices, catalog entries, correspondence)',
  'Risk flags and gap analysis',
  'Provenance certificate / report (institutional-grade)',
];

const pricingTiers = [
  {
    name: 'Basic Research',
    range: '€2,500–€7,500',
    hint: 'Focused gaps and targeted archive checks.',
  },
  {
    name: 'Full Provenance Build',
    range: '€8,000–€25,000',
    hint: 'Multi-source reconstruction with sustained outreach.',
  },
  {
    name: 'Institutional-Grade Diligence',
    range: '€25,000+',
    hint: 'Complex custody chains and highest scrutiny contexts.',
  },
];

const timelineFactors = [
  'Number of ownership gaps',
  'Responsiveness of galleries and institutions',
  'Age and significance of the asset',
];

const assessmentHref = `${pathsConfig.auth.signUp}?intent=provenance-assessment`;

export function ProvenanceServiceLanding() {
  const structuredData = getProvenanceServiceJsonLd();

  return (
    <>
      <main className="relative min-h-screen overflow-x-hidden bg-parchment font-landing text-ink selection:bg-wine/15">
        <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
          <div className="absolute -top-32 left-1/2 h-[min(90vw,720px)] w-[min(90vw,720px)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(74,47,37,0.12)_0%,transparent_68%)]" />
          <div className="absolute top-[40vh] -right-24 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(74,47,37,0.06)_0%,transparent_70%)] blur-2xl" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-wine/15 to-transparent" />
        </div>

        <header className="relative flex min-h-[min(72vh,820px)] flex-col items-center justify-center px-6 pb-16 pt-28 text-center sm:px-10">
          <div className="flex max-w-4xl flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-px w-12 bg-wine/35" />
              <SectionLabel>Provenance as a service</SectionLabel>
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-[0.06em] text-wine sm:text-5xl md:text-6xl lg:text-7xl lg:tracking-[0.08em]">
              Provenance, Built End-to-End
            </h1>
            <p className="max-w-2xl text-pretty text-base font-light leading-relaxed tracking-wide text-ink/65 sm:text-lg md:text-xl">
              Establish the history of your asset with the same rigor used by leading auction
              houses, museums, and collectors worldwide.
            </p>
            <p className="max-w-2xl text-pretty text-sm font-light leading-relaxed text-ink/55 sm:text-base md:text-lg">
              We reconstruct ownership, verify authenticity signals, and produce defensible
              documentation that increases trust, liquidity, and value.
            </p>
            <div className="flex h-px w-12 bg-wine/35" />
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:justify-center">
              <Link
                href={assessmentHref}
                className="group inline-flex items-center gap-2 rounded-xl bg-wine px-8 py-3.5 text-sm font-medium text-parchment shadow-sm transition-colors hover:bg-wine/90"
              >
                Start a Provenance Assessment
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </Link>
            </div>
            <p className="max-w-md text-center text-xs leading-relaxed text-ink/50 sm:text-sm">
              Submit your asset details and we&apos;ll provide a scoped plan within 3–5 business
              days.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-24 px-6 pb-28 sm:px-10 md:space-y-32 md:pb-36">
          <AboutReveal>
            <section aria-labelledby="ps-what-heading">
              <div className="mb-12 text-center md:mb-16">
                <SectionLabel>Scope</SectionLabel>
                <h2
                  id="ps-what-heading"
                  className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-5xl"
                >
                  What we do
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-ink/60 md:text-base">
                  We conduct deep provenance research across:
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                {researchAreas.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="group flex flex-col rounded-2xl border border-wine/10 bg-white/50 p-8 shadow-sm ring-1 ring-wine/5 transition-shadow duration-300 hover:shadow-lg hover:shadow-wine/5"
                  >
                    <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-wine/10 text-wine transition-colors group-hover:bg-wine/15">
                      <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
                    </span>
                    <p className="text-base font-semibold tracking-tight text-ink">{label}</p>
                  </div>
                ))}
              </div>
              <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-ink/65 md:text-base">
                Our team manages all outreach, follow-ups, and documentation—work that often takes
                months and requires persistent, informed engagement.
              </p>
            </section>
          </AboutReveal>

          <AboutReveal>
            <section
              className="overflow-hidden rounded-3xl border border-wine/10 bg-gradient-to-br from-wine/[0.07] via-parchment to-parchment shadow-sm ring-1 ring-wine/5"
              aria-labelledby="ps-why-heading"
            >
              <div className="grid gap-0 md:grid-cols-2">
                <div className="flex flex-col justify-center border-b border-wine/10 p-10 md:border-b-0 md:border-r md:p-14 lg:p-16">
                  <Quote className="mb-6 h-10 w-10 text-wine/35" strokeWidth={1} aria-hidden />
                  <SectionLabel>Why it matters</SectionLabel>
                  <h2
                    id="ps-why-heading"
                    className="mt-4 text-2xl font-semibold tracking-tight text-ink md:text-3xl"
                  >
                    Incomplete provenance creates risk
                  </h2>
                  <ul className="mt-8 space-y-4 text-left text-sm leading-relaxed text-ink/70 md:text-base">
                    {riskItems.map((line) => (
                      <li key={line} className="flex gap-3">
                        <Minus
                          className="mt-0.5 h-5 w-5 shrink-0 text-wine/45"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col justify-center p-10 md:p-14 lg:p-16">
                  <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-wine/10 bg-white/50 text-wine shadow-sm">
                    <FileStack className="h-6 w-6" strokeWidth={1.5} aria-hidden />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
                    Verified provenance
                  </h3>
                  <ul className="mt-8 space-y-4 text-sm leading-relaxed text-ink/75 md:text-base">
                    {benefitItems.map((line) => (
                      <li key={line} className="flex gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-wine/25 bg-wine/[0.08] text-wine">
                          <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          </AboutReveal>

          <AboutReveal>
            <section aria-labelledby="ps-process-heading">
              <div className="mb-12 text-center md:mb-16">
                <SectionLabel>Method</SectionLabel>
                <h2
                  id="ps-process-heading"
                  className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-5xl"
                >
                  Our process
                </h2>
              </div>
              <div className="relative overflow-hidden rounded-[2rem] border border-wine/12 bg-gradient-to-b from-white/60 via-parchment to-wine/[0.04] p-8 shadow-[0_32px_90px_-40px_rgba(74,47,37,0.22)] ring-1 ring-wine/[0.06] backdrop-blur-sm sm:p-10 md:p-12">
                <div
                  className="pointer-events-none absolute -right-24 top-1/2 h-[min(70vw,420px)] w-[min(70vw,420px)] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(74,47,37,0.06)_0%,transparent_65%)]"
                  aria-hidden
                />
                <div className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                  {processSteps.map((item) => (
                    <div
                      key={item.step}
                      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-wine/10 bg-white/55 p-6 shadow-sm ring-1 ring-black/[0.02] transition-all duration-300 hover:-translate-y-0.5 hover:border-wine/18 hover:bg-white/70 hover:shadow-lg hover:shadow-wine/10 md:p-7"
                    >
                      <div
                        className="pointer-events-none absolute inset-y-3 left-0 w-px bg-gradient-to-b from-wine/35 via-wine/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        aria-hidden
                      />
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wine/[0.09] text-wine transition-colors duration-300 group-hover:bg-wine/[0.14]">
                          <ScrollText className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                        </span>
                        <span className="select-none pt-0.5 font-mono text-[10px] font-medium tabular-nums tracking-widest text-wine/35">
                          {item.step}
                        </span>
                      </div>
                      <h3 className="mb-2.5 text-lg font-semibold tracking-tight text-ink md:text-xl">
                        {item.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-ink/65 md:text-[15px]">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </AboutReveal>

          <AboutReveal>
            <section
              className="relative grid gap-10 md:grid-cols-[auto_1fr] md:gap-14"
              aria-labelledby="ps-deliverables-heading"
            >
              <div className="hidden md:flex md:w-12 md:justify-center">
                <div className="h-full w-px bg-gradient-to-b from-wine/40 via-wine/15 to-transparent" />
              </div>
              <div className="rounded-3xl border border-wine/10 bg-white/45 p-8 shadow-sm ring-1 ring-wine/5 backdrop-blur-sm sm:p-10 md:p-14">
                <div className="mb-6 flex items-center gap-3 text-wine/80">
                  <FileStack className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
                  <SectionLabel>Deliverables</SectionLabel>
                </div>
                <h2
                  id="ps-deliverables-heading"
                  className="mb-8 text-3xl font-semibold tracking-tight text-ink md:text-4xl"
                >
                  What you receive
                </h2>
                <ul className="space-y-5 text-base leading-relaxed text-ink/75 md:text-lg">
                  {deliverables.map((line) => (
                    <li key={line} className="flex gap-4">
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-wine/20 bg-wine/[0.06] text-wine">
                        <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </AboutReveal>

          <AboutReveal>
            <section aria-labelledby="ps-pricing-heading">
              <div className="mb-12 text-center md:mb-16">
                <SectionLabel>Investment</SectionLabel>
                <h2
                  id="ps-pricing-heading"
                  className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-5xl"
                >
                  Pricing
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-ink/60 md:text-base">
                  Because every asset is different, pricing depends on complexity and depth of
                  research. Typical engagements range from:
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                {pricingTiers.map((tier) => (
                  <div
                    key={tier.name}
                    className="group flex flex-col rounded-2xl border border-wine/10 bg-white/50 p-8 shadow-sm ring-1 ring-wine/5 transition-shadow duration-300 hover:shadow-lg hover:shadow-wine/5"
                  >
                    <span className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-wine/45">
                      Typical range
                    </span>
                    <h3 className="mb-2 text-xl font-semibold tracking-tight text-ink">{tier.name}</h3>
                    <p className="mb-4 text-lg font-semibold tracking-tight text-wine md:text-xl">
                      {tier.range}
                    </p>
                    <p className="text-sm leading-relaxed text-ink/65 md:text-[15px]">{tier.hint}</p>
                  </div>
                ))}
              </div>
              <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-ink/60">
                We begin with a paid assessment to scope the work and provide a clear proposal.
              </p>
            </section>
          </AboutReveal>

          <AboutReveal>
            <section aria-labelledby="ps-timeline-heading">
              <div className="relative overflow-hidden rounded-3xl border border-wine/10 bg-white/50 p-8 shadow-sm ring-1 ring-wine/5 backdrop-blur-sm sm:p-10 md:p-12">
                <div
                  className="pointer-events-none absolute inset-x-0 -top-6 flex justify-center"
                  aria-hidden
                >
                  <div className="h-16 w-px bg-gradient-to-b from-transparent via-wine/25 to-transparent" />
                </div>
                <h2
                  id="ps-timeline-heading"
                  className="text-center text-3xl font-semibold tracking-tight text-ink md:text-4xl"
                >
                  Timeline
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-ink/65 md:text-base">
                  Most projects take{' '}
                  <span className="font-medium text-ink">4 weeks to 6 months</span>, depending on:
                </p>
                <ul className="mx-auto mt-8 max-w-xl space-y-3 text-sm leading-relaxed text-ink/70 md:text-base">
                  {timelineFactors.map((line) => (
                    <li key={line} className="flex items-start gap-3">
                      <ArrowRight
                        className="mt-0.5 h-4 w-4 shrink-0 text-wine/50"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </AboutReveal>

          <AboutReveal>
            <section
              className="overflow-hidden rounded-3xl border border-wine/10 bg-gradient-to-br from-wine/[0.07] via-parchment to-parchment shadow-sm ring-1 ring-wine/5"
              aria-labelledby="ps-quote-heading"
            >
              <div className="p-10 md:p-14 lg:p-16">
                <Quote className="mb-6 h-10 w-10 text-wine/35" strokeWidth={1} aria-hidden />
                <h2 id="ps-quote-heading" className="sr-only">
                  Perspective
                </h2>
                <blockquote className="text-xl font-semibold leading-relaxed tracking-tight text-ink md:text-2xl">
                  &ldquo;A defensible provenance file is the difference between a bid and a
                  pass—especially at the top of the market.&rdquo;
                </blockquote>
                <p className="mt-6 text-sm leading-relaxed text-ink/60 md:text-base">
                  How we think about diligence — aligned with auction, museum, and private treaty
                  standards.
                </p>
              </div>
            </section>
          </AboutReveal>

          <AboutReveal>
            <section aria-labelledby="provenance-faq-heading" className="space-y-6">
              <div className="text-center">
                <SectionLabel>Questions</SectionLabel>
                <h2
                  id="provenance-faq-heading"
                  className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-5xl"
                >
                  Common questions
                </h2>
              </div>
              <div className="mx-auto max-w-3xl space-y-3">
                {PROVENANCE_SERVICE_FAQS.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-2xl border border-wine/10 bg-white/50 shadow-sm ring-1 ring-wine/5 backdrop-blur-sm transition-colors hover:border-wine/18"
                  >
                    <summary className="cursor-pointer list-none px-5 py-4 font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden md:px-6 md:py-5">
                      <span className="flex items-center justify-between gap-4">
                        <span className="text-left text-sm md:text-base">{item.question}</span>
                        <ChevronDown
                          className="h-5 w-5 shrink-0 text-wine/45 transition-transform duration-300 group-open:rotate-180"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </span>
                    </summary>
                    <p className="border-t border-wine/10 px-5 pb-5 pt-4 text-sm leading-relaxed text-ink/70 md:px-6 md:text-[15px]">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          </AboutReveal>

          <AboutReveal>
            <section
              className="relative overflow-hidden rounded-3xl bg-wine px-8 py-14 text-center text-parchment shadow-xl ring-1 ring-wine/20 sm:px-12 md:py-16"
              aria-labelledby="ps-cta-heading"
            >
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-parchment/10 blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-parchment/5 blur-2xl"
                aria-hidden
              />
              <h2
                id="ps-cta-heading"
                className="relative text-3xl font-semibold tracking-tight text-parchment md:text-4xl"
              >
                Start a Provenance Assessment
              </h2>
              <p className="relative mx-auto mt-5 max-w-2xl text-base font-light leading-relaxed text-parchment/75 md:text-lg">
                Submit your asset details and we&apos;ll provide a scoped plan within 3–5 business
                days.
              </p>
              <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href={assessmentHref}
                  className="group inline-flex items-center gap-2 rounded-xl bg-parchment px-8 py-3.5 text-sm font-medium text-wine shadow-sm transition-colors hover:bg-parchment/90"
                >
                  Begin intake
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-parchment/35 px-8 py-3.5 text-sm font-medium text-parchment/95 transition-colors hover:bg-parchment/10"
                >
                  Main site
                </Link>
              </div>
            </section>
          </AboutReveal>
        </div>

        <footer className="border-t border-wine/10 px-6 py-12 text-center text-sm text-ink/50 sm:px-10">
          <p>
            © {new Date().getFullYear()} Provenance Platform.
            {' · '}
            <Link href="/" className="text-wine/80 underline-offset-4 hover:underline">
              Home
            </Link>
          </p>
        </footer>
      </main>

      {structuredData.map((json, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
        />
      ))}
    </>
  );
}
