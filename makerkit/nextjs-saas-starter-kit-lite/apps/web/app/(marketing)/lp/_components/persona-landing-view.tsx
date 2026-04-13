import Link from 'next/link';

import { Check, Quote } from 'lucide-react';

import { CtaButton } from '@kit/ui/marketing';
import { Badge } from '@kit/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import type { PersonaLandingConfig } from './persona-landing-data';
import { getPersonaJsonLd } from './persona-landing-seo';

export function PersonaLandingView({ config }: { config: PersonaLandingConfig }) {
  const structuredData = getPersonaJsonLd(config.slug);

  return (
    <div className="flex flex-col">
      <section
        className={cn(
          'border-b bg-gradient-to-br text-white',
          config.accentClass,
        )}
      >
        <div className="container max-w-4xl space-y-10 py-16 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            {config.pill}
          </p>
          <div className="space-y-6">
            <h1 className="font-heading text-4xl font-medium tracking-tight md:text-5xl">
              {config.title}
            </h1>
            <p className="max-w-2xl text-lg text-white/85 md:text-xl">
              {config.subtitle}
            </p>
          </div>
          <ul className="max-w-2xl space-y-4">
            {config.outcomes.map((line) => (
              <li key={line} className="flex gap-3 text-base text-white/90 md:text-lg">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div>
            <CtaButton variant="secondary" className="bg-white text-slate-900 hover:bg-white/90" asChild>
              <Link href={config.cta.href}>{config.cta.label}</Link>
            </CtaButton>
          </div>
        </div>
      </section>

      <section className="container max-w-4xl space-y-8 py-16 md:py-20">
        <div className="space-y-2">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl dark:text-white">
            {config.proofSectionTitle}
          </h2>
          <p className="text-muted-foreground max-w-2xl text-base">
            We are shipping evidence as fast as we ship code—placeholders mark what is coming next.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {config.proofCards.map((card) => (
            <Card
              key={card.title}
              className="border-dashed bg-muted/30 dark:border-white/10 dark:bg-white/5"
            >
              <CardHeader className="space-y-2 pb-2">
                {card.badge ? (
                  <Badge variant="outline" className="w-fit text-xs font-normal">
                    {card.badge}
                  </Badge>
                ) : null}
                <CardTitle className="text-base font-semibold leading-snug">
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">{card.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10">
          <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-start md:gap-6">
            <div className="bg-primary/15 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full dark:text-primary-foreground">
              <Quote className="h-6 w-6" aria-hidden />
            </div>
            <div className="space-y-3">
              <blockquote className="text-lg font-medium leading-relaxed md:text-xl">
                “{config.testimonial.quote}”
              </blockquote>
              <p className="text-muted-foreground text-sm">{config.testimonial.attribution}</p>
              <p className="text-muted-foreground text-xs italic">
                {config.testimonial.statusNote}
              </p>
            </div>
          </CardContent>
        </Card>

        <section aria-labelledby="faq-heading" className="space-y-4">
          <h2
            id="faq-heading"
            className="font-heading text-2xl font-semibold tracking-tight md:text-3xl dark:text-white"
          >
            Common questions
          </h2>
          <div className="space-y-3">
            {config.faqs.map((item) => (
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
