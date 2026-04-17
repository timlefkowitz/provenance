import Link from 'next/link';

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  FileStack,
  Gavel,
  Landmark,
  Quote,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { CtaButton } from '@kit/ui/marketing';
import { Badge } from '@kit/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import {
  getProvenanceServiceJsonLd,
  PROVENANCE_SERVICE_FAQS,
} from './provenance-service-seo';

const accentClass =
  'from-stone-950/95 via-amber-950/80 to-orange-950/75 dark:from-stone-900 dark:via-amber-950/85 dark:to-stone-950';

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
    step: '1',
    title: 'Intake & Assessment',
    body: 'We evaluate your asset and identify provenance gaps.',
  },
  {
    step: '2',
    title: 'Research & Outreach',
    body: 'We contact galleries, archives, and relevant parties globally.',
  },
  {
    step: '3',
    title: 'Documentation & Verification',
    body: 'We compile and validate all findings into a structured record.',
  },
  {
    step: '4',
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
    <div className="flex flex-col">
      <section
        className={cn(
          'border-b bg-gradient-to-br text-white',
          accentClass,
        )}
      >
        <div className="container max-w-4xl space-y-10 py-16 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            Provenance as a service
          </p>
          <div className="space-y-6">
            <h1 className="font-heading text-4xl font-medium tracking-tight md:text-5xl">
              Provenance, Built End-to-End
            </h1>
            <p className="max-w-2xl text-lg text-white/85 md:text-xl">
              Establish the history of your asset with the same rigor used by leading auction
              houses, museums, and collectors worldwide.
            </p>
            <p className="max-w-2xl text-base text-white/80 md:text-lg">
              We reconstruct ownership, verify authenticity signals, and produce defensible
              documentation that increases trust, liquidity, and value.
            </p>
          </div>
          <div>
            <CtaButton
              variant="secondary"
              className="bg-white text-slate-900 hover:bg-white/90"
              asChild
            >
              <Link href={assessmentHref}>Start a Provenance Assessment</Link>
            </CtaButton>
            <p className="mt-4 max-w-xl text-sm text-white/70">
              Submit your asset details and we&apos;ll provide a scoped plan within 3–5 business
              days.
            </p>
          </div>
        </div>
      </section>

      <section className="container max-w-4xl space-y-16 py-16 md:py-20">
        <div className="space-y-6">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl dark:text-white">
            What we do
          </h2>
          <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
            We conduct deep provenance research across:
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {researchAreas.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="border-border bg-card flex items-center gap-3 rounded-lg border px-4 py-3 dark:border-white/10 dark:bg-white/5"
              >
                <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-foreground text-sm font-medium leading-snug">{label}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed md:text-base">
            Our team manages all outreach, follow-ups, and documentation—work that often takes
            months and requires persistent, informed engagement.
          </p>
        </div>

        <div className="space-y-6">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl dark:text-white">
            Why it matters
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-destructive/25 bg-destructive/5 dark:border-destructive/30 dark:bg-destructive/10">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className="text-destructive h-5 w-5 shrink-0"
                    aria-hidden
                  />
                  <CardTitle className="text-base">Incomplete provenance creates risk</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {riskItems.map((line) => (
                    <li key={line} className="text-muted-foreground flex gap-2 text-sm">
                      <span className="text-destructive mt-0.5 font-bold">×</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/25 bg-emerald-500/5 dark:border-emerald-400/20 dark:bg-emerald-500/10">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                  <CardTitle className="text-base">Verified provenance</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {benefitItems.map((line) => (
                    <li key={line} className="text-muted-foreground flex gap-2 text-sm">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl dark:text-white">
            Our process
          </h2>
          <ol className="relative space-y-0 border-l border-dashed border-amber-900/30 pl-8 dark:border-amber-700/40 md:pl-10">
            {processSteps.map(({ step, title, body }, i) => (
              <li key={step} className={cn('relative pb-12 last:pb-0', i === 0 && 'pt-0')}>
                <span
                  className="bg-background border-border absolute -left-[39px] top-0.5 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold shadow-sm dark:border-white/15 md:-left-[47px] md:h-9 md:w-9"
                  aria-hidden
                >
                  {step}
                </span>
                <div className="space-y-2">
                  <h3 className="text-foreground font-heading text-lg font-semibold">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <FileStack className="text-primary h-6 w-6" aria-hidden />
            <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl dark:text-white">
              Deliverables
            </h2>
          </div>
          <ul className="max-w-2xl space-y-4">
            {deliverables.map((line) => (
              <li key={line} className="flex gap-3 text-base leading-relaxed">
                <span className="bg-primary/15 text-primary mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl dark:text-white">
            Pricing
          </h2>
          <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
            Because every asset is different, pricing depends on complexity and depth of research.
            Typical engagements range from:
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.name}
                className="border-border bg-muted/20 dark:border-white/10 dark:bg-white/5"
              >
                <CardHeader className="space-y-2 pb-2">
                  <Badge variant="outline" className="w-fit text-xs font-normal">
                    Estimate
                  </Badge>
                  <CardTitle className="text-base font-semibold leading-snug">{tier.name}</CardTitle>
                  <p className="text-foreground text-lg font-semibold tracking-tight">{tier.range}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">{tier.hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            We begin with a paid assessment to scope the work and provide a clear proposal.
          </p>
        </div>

        <Card className="border-border bg-gradient-to-br from-stone-50 to-amber-50/60 dark:border-white/10 dark:from-white/5 dark:to-amber-950/20">
          <CardHeader>
            <CardTitle className="font-heading text-xl md:text-2xl">Timeline</CardTitle>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Most projects take <strong className="text-foreground font-medium">4 weeks to 6 months</strong>
              , depending on:
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {timelineFactors.map((line) => (
                <li key={line} className="text-muted-foreground flex items-start gap-2 text-sm">
                  <ArrowRight className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10">
          <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-start md:gap-6">
            <div className="bg-primary/15 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full dark:text-primary-foreground">
              <Quote className="h-6 w-6" aria-hidden />
            </div>
            <div className="space-y-3">
              <blockquote className="text-lg font-medium leading-relaxed md:text-xl">
                “A defensible provenance file is the difference between a bid and a pass—especially
                at the top of the market.”
              </blockquote>
              <p className="text-muted-foreground text-sm">
                How we think about diligence — aligned with auction, museum, and private treaty
                standards.
              </p>
            </div>
          </CardContent>
        </Card>

        <section aria-labelledby="provenance-faq-heading" className="space-y-4">
          <h2
            id="provenance-faq-heading"
            className="font-heading text-2xl font-semibold tracking-tight md:text-3xl dark:text-white"
          >
            Common questions
          </h2>
          <div className="space-y-3">
            {PROVENANCE_SERVICE_FAQS.map((item) => (
              <details
                key={item.question}
                className="border-border bg-card rounded-lg border dark:border-white/10 dark:bg-white/5"
              >
                <summary className="text-foreground hover:bg-muted/40 cursor-pointer list-none rounded-lg px-4 py-4 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  {item.question}
                </summary>
                <p className="text-muted-foreground border-border/60 mx-4 mb-4 border-t pt-3 text-sm leading-relaxed">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section
          className={cn(
            'overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br px-6 py-10 text-white md:px-10 md:py-12',
            accentClass,
          )}
        >
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              Start a Provenance Assessment
            </h2>
            <p className="text-white/85 text-base md:text-lg">
              Submit your asset details and we&apos;ll provide a scoped plan within 3–5 business
              days.
            </p>
            <CtaButton
              variant="secondary"
              className="bg-white text-slate-900 hover:bg-white/90"
              asChild
            >
              <Link href={assessmentHref}>Begin intake</Link>
            </CtaButton>
          </div>
        </section>

        <div className="border-t pt-10">
          <p className="text-muted-foreground text-sm">
            <Link href="/" className="text-primary font-medium underline-offset-4 hover:underline">
              Main marketing site
            </Link>
          </p>
        </div>
      </section>

      {structuredData.map((json, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
        />
      ))}
    </div>
  );
}
