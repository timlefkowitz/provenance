import Link from 'next/link';

import {
  ArrowRight,
  FileStack,
  Link2,
  ListOrdered,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { FeatureCard, FeatureGrid } from '@kit/ui/marketing';

import { PersonaInternalLinks } from '~/(marketing)/_components/persona-internal-links';
import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import appConfig from '~/config/app.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export const generateMetadata = async () => {
  const { t } = await createI18nServerInstance();
  const title = t('marketing:certificateOfAuthenticityPageTitle');
  const description = t('marketing:certificateOfAuthenticityPageDescription');
  const pageUrl = new URL(
    '/create-certificate-of-authenticity',
    appConfig.url,
  ).href;
  const defaultOg = new URL('/opengraph-image', appConfig.url).href;

  return {
    title,
    description,
    openGraph: {
      type: 'article',
      url: pageUrl,
      siteName: appConfig.name,
      title,
      description,
      images: [
        {
          url: defaultOg,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [defaultOg],
    },
  };
};

async function CreateCertificateOfAuthenticityPage() {
  const { t } = await createI18nServerInstance();

  const traditionalPainPoints = [
    t('marketing:certificateOfAuthenticityTraditionalFail1'),
    t('marketing:certificateOfAuthenticityTraditionalFail2'),
    t('marketing:certificateOfAuthenticityTraditionalFail3'),
    t('marketing:certificateOfAuthenticityTraditionalFail4'),
  ];

  const stepItems = [
    {
      title: t('marketing:certificateOfAuthenticityStep1Title'),
      body: t('marketing:certificateOfAuthenticityStep1Body'),
    },
    {
      title: t('marketing:certificateOfAuthenticityStep2Title'),
      body: t('marketing:certificateOfAuthenticityStep2Body'),
    },
    {
      title: t('marketing:certificateOfAuthenticityStep3Title'),
      body: t('marketing:certificateOfAuthenticityStep3Body'),
    },
    {
      title: t('marketing:certificateOfAuthenticityStep4Title'),
      body: t('marketing:certificateOfAuthenticityStep4Body'),
    },
    {
      title: t('marketing:certificateOfAuthenticityStep5Title'),
      body: t('marketing:certificateOfAuthenticityStep5Body'),
    },
    {
      title: t('marketing:certificateOfAuthenticityStep6Title'),
      body: t('marketing:certificateOfAuthenticityStep6Body'),
    },
  ];

  const collectorPoints = [
    t('marketing:certificateOfAuthenticityCollectorsPoint1'),
    t('marketing:certificateOfAuthenticityCollectorsPoint2'),
    t('marketing:certificateOfAuthenticityCollectorsPoint3'),
    t('marketing:certificateOfAuthenticityCollectorsPoint4'),
    t('marketing:certificateOfAuthenticityCollectorsPoint5'),
  ];

  const valuePoints = [
    t('marketing:certificateOfAuthenticityValuePoint1'),
    t('marketing:certificateOfAuthenticityValuePoint2'),
    t('marketing:certificateOfAuthenticityValuePoint3'),
  ];

  return (
    <div className={'flex flex-col space-y-4 xl:space-y-8'}>
      <SitePageHeader
        title={t('marketing:certificateOfAuthenticityPageTitle')}
        subtitle={t('marketing:certificateOfAuthenticityPageSubtitle')}
      />

      <div
        className={
          'container flex max-w-4xl flex-col space-y-16 pb-20 md:space-y-20'
        }
      >
        <section className={'flex flex-col space-y-4'}>
          <p className={'text-muted-foreground text-lg leading-relaxed'}>
            {t('marketing:certificateOfAuthenticityLead')}
          </p>
        </section>

        <section className={'flex flex-col space-y-4'}>
          <h2
            className={
              'font-heading text-2xl font-medium tracking-tight md:text-3xl'
            }
          >
            {t('marketing:certificateOfAuthenticityWhatHeading')}
          </h2>
          <p className={'text-muted-foreground text-base leading-relaxed'}>
            {t('marketing:certificateOfAuthenticityWhatBody')}
          </p>
        </section>

        <section
          className={
            'bg-muted/40 border-border flex flex-col space-y-6 rounded-2xl border p-6 md:p-8'
          }
        >
          <div className={'flex flex-col space-y-2'}>
            <h2
              className={
                'font-heading text-2xl font-medium tracking-tight md:text-3xl'
              }
            >
              {t('marketing:certificateOfAuthenticityTraditionalHeading')}
            </h2>
            <p className={'text-muted-foreground text-base leading-relaxed'}>
              {t('marketing:certificateOfAuthenticityTraditionalIntro')}
            </p>
          </div>
          <ul className={'flex flex-col space-y-3'}>
            {traditionalPainPoints.map((item) => (
              <li
                key={item}
                className={
                  'border-border flex gap-3 rounded-xl border bg-background/60 px-4 py-3 text-sm leading-relaxed md:text-base'
                }
              >
                <span
                  className={
                    'text-primary mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-current'
                  }
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={'flex flex-col space-y-6'}>
          <div className={'flex flex-col space-y-2'}>
            <div className={'flex items-center gap-2'}>
              <ListOrdered
                className={'text-primary h-6 w-6 shrink-0'}
                aria-hidden
              />
              <h2
                className={
                  'font-heading text-2xl font-medium tracking-tight md:text-3xl'
                }
              >
                {t('marketing:certificateOfAuthenticityStepsHeading')}
              </h2>
            </div>
            <p className={'text-muted-foreground text-base leading-relaxed'}>
              {t('marketing:certificateOfAuthenticityStepsIntro')}
            </p>
          </div>

          <ol className={'flex flex-col gap-4'}>
            {stepItems.map((step, index) => (
              <li
                key={step.title}
                className={
                  'border-border flex gap-4 rounded-2xl border bg-background/60 p-4 md:gap-5 md:p-5'
                }
              >
                <span
                  className={
                    'bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums'
                  }
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div className={'flex min-w-0 flex-col space-y-2'}>
                  <h3 className={'text-base font-medium md:text-lg'}>
                    {step.title}
                  </h3>
                  <p
                    className={
                      'text-muted-foreground text-sm leading-relaxed md:text-base'
                    }
                  >
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={'flex flex-col space-y-6'}>
          <div className={'flex flex-col space-y-2'}>
            <div className={'flex items-center gap-2'}>
              <Sparkles
                className={'text-primary h-6 w-6 shrink-0'}
                aria-hidden
              />
              <h2
                className={
                  'font-heading text-2xl font-medium tracking-tight md:text-3xl'
                }
              >
                {t('marketing:certificateOfAuthenticityCollectorsHeading')}
              </h2>
            </div>
            <p className={'text-muted-foreground text-base leading-relaxed'}>
              {t('marketing:certificateOfAuthenticityCollectorsIntro')}
            </p>
          </div>
          <ul className={'flex flex-col space-y-3'}>
            {collectorPoints.map((item) => (
              <li
                key={item}
                className={
                  'border-border flex gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm leading-relaxed md:text-base'
                }
              >
                <span
                  className={
                    'text-primary mt-1.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-current'
                  }
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={'flex flex-col space-y-6'}>
          <div className={'flex flex-col space-y-2'}>
            <h2
              className={
                'font-heading text-2xl font-medium tracking-tight md:text-3xl'
              }
            >
              {t('marketing:certificateOfAuthenticityDigitalVsPaperHeading')}
            </h2>
            <p className={'text-muted-foreground text-base leading-relaxed'}>
              {t('marketing:certificateOfAuthenticityDigitalVsPaperIntro')}
            </p>
          </div>
          <div className={'grid gap-4 md:grid-cols-2'}>
            <article
              className={
                'border-border flex flex-col space-y-3 rounded-2xl border p-5 md:p-6'
              }
            >
              <h3 className={'text-lg font-medium'}>
                {t('marketing:certificateOfAuthenticityDigitalColumnTitle')}
              </h3>
              <p className={'text-muted-foreground text-sm leading-relaxed'}>
                {t('marketing:certificateOfAuthenticityDigitalColumnBody')}
              </p>
            </article>
            <article
              className={
                'border-border flex flex-col space-y-3 rounded-2xl border p-5 md:p-6'
              }
            >
              <h3 className={'text-lg font-medium'}>
                {t('marketing:certificateOfAuthenticityPaperColumnTitle')}
              </h3>
              <p className={'text-muted-foreground text-sm leading-relaxed'}>
                {t('marketing:certificateOfAuthenticityPaperColumnBody')}
              </p>
            </article>
          </div>
        </section>

        <section
          className={
            'bg-muted/40 border-border flex flex-col space-y-6 rounded-2xl border p-6 md:p-8'
          }
        >
          <div className={'flex flex-col space-y-2'}>
            <div className={'flex items-center gap-2'}>
              <Scale className={'text-primary h-6 w-6 shrink-0'} aria-hidden />
              <h2
                className={
                  'font-heading text-2xl font-medium tracking-tight md:text-3xl'
                }
              >
                {t('marketing:certificateOfAuthenticityValueHeading')}
              </h2>
            </div>
            <p className={'text-muted-foreground text-base leading-relaxed'}>
              {t('marketing:certificateOfAuthenticityValueIntro')}
            </p>
          </div>
          <ul className={'flex flex-col space-y-3'}>
            {valuePoints.map((item) => (
              <li
                key={item}
                className={
                  'border-border flex gap-3 rounded-xl border bg-background/60 px-4 py-3 text-sm leading-relaxed md:text-base'
                }
              >
                <span
                  className={
                    'text-primary mt-1.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-current'
                  }
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={'flex flex-col space-y-6'}>
          <div className={'flex flex-col space-y-2'}>
            <h2
              className={
                'font-heading text-2xl font-medium tracking-tight md:text-3xl'
              }
            >
              {t('marketing:certificateOfAuthenticityPositioningHeading')}
            </h2>
            <p className={'text-muted-foreground text-base leading-relaxed'}>
              {t('marketing:certificateOfAuthenticityPositioningIntro')}
            </p>
          </div>

          <FeatureGrid>
            <FeatureCard
              className={'bg-background/60'}
              label={t('marketing:certificateOfAuthenticityLivingDocumentsTitle')}
              description={t(
                'marketing:certificateOfAuthenticityLivingDocumentsBody',
              )}
            />
            <FeatureCard
              className={'bg-background/60'}
              label={t(
                'marketing:certificateOfAuthenticityVerifiableProvenanceTitle',
              )}
              description={t(
                'marketing:certificateOfAuthenticityVerifiableProvenanceBody',
              )}
            />
            <FeatureCard
              className={'bg-background/60'}
              label={t(
                'marketing:certificateOfAuthenticityChainOfOwnershipTitle',
              )}
              description={t(
                'marketing:certificateOfAuthenticityChainOfOwnershipBody',
              )}
            />
          </FeatureGrid>
        </section>

        <section className={'flex flex-col space-y-6'}>
          <div className={'flex flex-col space-y-2'}>
            <h2
              className={
                'font-heading text-2xl font-medium tracking-tight md:text-3xl'
              }
            >
              {t('marketing:certificateOfAuthenticityMutableHeading')}
            </h2>
            <p className={'text-muted-foreground text-base leading-relaxed'}>
              {t('marketing:certificateOfAuthenticityMutableIntro')}
            </p>
          </div>

          <div className={'grid gap-4 md:grid-cols-2'}>
            <article
              className={
                'border-border flex flex-col space-y-3 rounded-2xl border p-5 md:p-6'
              }
            >
              <div className={'flex items-center gap-2'}>
                <FileStack
                  className={'text-primary h-5 w-5'}
                  aria-hidden
                />
                <h3 className={'text-lg font-medium'}>
                  {t('marketing:certificateOfAuthenticityCreatableTitle')}
                </h3>
              </div>
              <p className={'text-muted-foreground text-sm leading-relaxed'}>
                {t('marketing:certificateOfAuthenticityCreatableBody')}
              </p>
            </article>

            <article
              className={
                'border-border flex flex-col space-y-3 rounded-2xl border p-5 md:p-6'
              }
            >
              <div className={'flex items-center gap-2'}>
                <ShieldCheck
                  className={'text-primary h-5 w-5'}
                  aria-hidden
                />
                <h3 className={'text-lg font-medium'}>
                  {t('marketing:certificateOfAuthenticityUpdateableTitle')}
                </h3>
              </div>
              <p className={'text-muted-foreground text-sm leading-relaxed'}>
                {t('marketing:certificateOfAuthenticityUpdateableBody')}
              </p>
            </article>
          </div>

          <p className={'text-muted-foreground text-sm leading-relaxed'}>
            {t('marketing:certificateOfAuthenticityMutableFootnote')}
          </p>
        </section>

        <PersonaInternalLinks />

        <section
          className={
            'border-border from-background to-muted/30 flex flex-col gap-4 rounded-2xl border bg-gradient-to-br p-6 md:flex-row md:items-center md:justify-between md:p-8'
          }
        >
          <div className={'flex max-w-xl flex-col space-y-2'}>
            <div className={'flex items-center gap-2'}>
              <Link2 className={'text-primary h-5 w-5'} aria-hidden />
              <h2 className={'text-xl font-medium md:text-2xl'}>
                {t('marketing:certificateOfAuthenticityCtaHeading')}
              </h2>
            </div>
            <p className={'text-muted-foreground text-sm leading-relaxed'}>
              {t('marketing:certificateOfAuthenticityCtaBody')}
            </p>
          </div>

          <Button asChild className={'shrink-0'} size={'lg'}>
            <Link href={'/auth/sign-up'}>
              <span>{t('marketing:certificateOfAuthenticityCtaButton')}</span>
              <ArrowRight className={'ml-2 h-4 w-4'} />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}

export default withI18n(CreateCertificateOfAuthenticityPage);
