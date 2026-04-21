import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowRightIcon, ShieldCheck } from 'lucide-react';

import {
  CtaButton,
  FeatureCard,
  FeatureGrid,
  FeatureShowcase,
  FeatureShowcaseIconContainer,
  Hero,
  Pill,
} from '@kit/ui/marketing';

import { FoundersSection } from '~/(marketing)/_components/founders-section';
import { PersonaInternalLinks } from '~/(marketing)/_components/persona-internal-links';
import appConfig from '~/config/app.config';
import { withI18n } from '~/lib/i18n/with-i18n';

export const metadata: Metadata = {
  alternates: {
    canonical: appConfig.url,
  },
  keywords: [
    'certificate of authenticity',
    'art provenance',
    'provenance registry',
    'artwork documentation',
    'certificate of ownership',
    'gallery management software',
    'artist CRM',
    'collection management',
    'open calls art',
    'art authentication',
    'museum collection software',
  ],
};

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: appConfig.name,
    url: appConfig.url,
    description: appConfig.description,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: appConfig.name,
    url: appConfig.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${appConfig.url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  },
];

function Home() {
  return (
    <>
      <script
        key="ld:json"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className={'mt-4 flex flex-col space-y-24 py-14'}>
        <div className={'container mx-auto'}>
          <Hero
            pill={
              <Pill label={'Registry'}>
                <span>
                  For artists, collectors, galleries, and institutions
                </span>
              </Pill>
            }
            title={
              <>
                <span>Provenance for every</span>
                <span>artwork, object, and transfer</span>
              </>
            }
            subtitle={
              <span>
                The registry where artists issue certificates, collectors build
                defensible records, galleries run shows, and institutions track
                custody — all on one verifiable platform.
              </span>
            }
            cta={<MainCallToActionButton />}
          />
        </div>

        <div className={'container mx-auto max-w-5xl px-4'}>
          <PersonaInternalLinks />
        </div>

        <div className={'container mx-auto'}>
          <div
            className={
              'flex flex-col space-y-16 xl:space-y-32 2xl:space-y-36'
            }
          >
            <FeatureShowcase
              heading={
                <>
                  <b className="font-semibold dark:text-white">
                    The complete provenance stack.
                  </b>{' '}
                  <span className="text-muted-foreground font-normal">
                    One platform for certificates, registries, and everyone who
                    depends on them.
                  </span>
                </>
              }
              icon={
                <FeatureShowcaseIconContainer>
                  <ShieldCheck className="h-5" />
                  <span>Trust by design</span>
                </FeatureShowcaseIconContainer>
              }
            >
              <FeatureGrid>
                <FeatureCard
                  className={'relative col-span-2 overflow-hidden'}
                  label={'Certificates of Authenticity'}
                  description={
                    'Artist-first CoA workflows with claim, verify, and publish states. A structured digital record stronger than a PDF stored in email.'
                  }
                />

                <FeatureCard
                  className={
                    'relative col-span-2 w-full overflow-hidden lg:col-span-1'
                  }
                  label={'Collector Records'}
                  description={
                    'Ownership certificates tied to rich provenance fields — auction history, former owners, and private drafts you control.'
                  }
                />

                <FeatureCard
                  className={
                    'relative col-span-2 overflow-hidden lg:col-span-1'
                  }
                  label={'Gallery & Open Calls'}
                  description={
                    'Exhibitions, submission windows, and staff permissions in one system. Certificates of show aligned to gallery workflows.'
                  }
                />

                <FeatureCard
                  className={'relative col-span-2 overflow-hidden'}
                  label={'Institution-Grade Tools'}
                  description={
                    'Loans, invoicing, accessioning, and an append-only audit trail. Scoped API keys for partner verification — built for the standards museums and foundations require.'
                  }
                />
              </FeatureGrid>
            </FeatureShowcase>
          </div>
        </div>
        <FoundersSection />
      </div>
    </>
  );
}

export default withI18n(Home);

function MainCallToActionButton() {
  return (
    <div className={'flex space-x-4'}>
      <CtaButton>
        <Link href={'/auth/sign-up'}>
          <span className={'flex items-center space-x-0.5'}>
            <span>Start free</span>

            <ArrowRightIcon
              className={
                'animate-in fade-in slide-in-from-left-8 h-4' +
                ' zoom-in fill-mode-both delay-1000 duration-1000'
              }
            />
          </span>
        </Link>
      </CtaButton>

      <CtaButton variant={'link'}>
        <Link href={'/create-certificate-of-authenticity'}>
          How certificates work
        </Link>
      </CtaButton>
    </div>
  );
}
