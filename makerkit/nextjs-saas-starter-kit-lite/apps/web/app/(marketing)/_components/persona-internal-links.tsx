import Link from 'next/link';

import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

const LINKS = [
  {
    href: '/lp/artist',
    titleKey: 'marketing:personaLinkArtist',
    descriptionKey: 'marketing:personaLinkArtistDescription',
  },
  {
    href: '/lp/collector',
    titleKey: 'marketing:personaLinkCollector',
    descriptionKey: 'marketing:personaLinkCollectorDescription',
  },
  {
    href: '/lp/gallery',
    titleKey: 'marketing:personaLinkGallery',
    descriptionKey: 'marketing:personaLinkGalleryDescription',
  },
  {
    href: '/lp/institution',
    titleKey: 'marketing:personaLinkInstitution',
    descriptionKey: 'marketing:personaLinkInstitutionDescription',
  },
] as const;

type Variant = 'cards' | 'compact';

export function PersonaInternalLinks({
  variant = 'cards',
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  if (variant === 'compact') {
    return (
      <nav aria-label="Audience" className={cn('flex flex-wrap gap-x-4 gap-y-2', className)}>
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          >
            <Trans i18nKey={item.titleKey} />
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <section
      aria-labelledby="persona-links-heading"
      className={cn('border-border bg-muted/20 rounded-2xl border p-6 md:p-8', className)}
    >
      <div className="mb-6 max-w-2xl space-y-2">
        <h2
          id="persona-links-heading"
          className="font-heading text-xl font-semibold tracking-tight md:text-2xl dark:text-white"
        >
          <Trans i18nKey="marketing:personaLinksHeading" />
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
          <Trans i18nKey="marketing:personaLinksIntro" />
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="border-border bg-card hover:border-primary/40 group flex h-full flex-col rounded-xl border p-4 transition-colors md:p-5 dark:bg-background/60"
            >
              <span className="font-heading text-base font-semibold tracking-tight group-hover:text-primary md:text-lg dark:text-white">
                <Trans i18nKey={item.titleKey} />
              </span>
              <span className="text-muted-foreground mt-2 text-sm leading-relaxed">
                <Trans i18nKey={item.descriptionKey} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
