import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowRightIcon, Lock, ShieldCheck, UserCheck } from 'lucide-react';

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
        <DataTransparencySection />
        <FoundersSection />
      </div>
    </>
  );
}

export default withI18n(Home);

function DataTransparencySection() {
  return (
    <section
      id="data-privacy"
      className="container mx-auto max-w-5xl px-4"
      aria-label="How we use your data"
    >
      <div className="border-border bg-muted/40 rounded-2xl border p-8 md:p-12">
        <div className="mb-8 text-center">
          <p className="text-primary mb-3 text-sm font-semibold tracking-widest uppercase">
            Your data &amp; privacy
          </p>
          <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
            How Provenance uses your information
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-base">
            Provenance is a provenance registry for the art world. When you sign
            in with Google, we request only the minimum data needed to create
            and maintain your account.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="flex flex-col items-start gap-3 rounded-xl bg-white p-6 shadow-sm dark:bg-white/5">
            <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
              <UserCheck className="h-5 w-5" />
            </div>
            <h3 className="text-foreground font-semibold">
              What we access via Google
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your email address, display name, and profile photo. These are
              used only to create your account and display your identity within
              Provenance.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 rounded-xl bg-white p-6 shadow-sm dark:bg-white/5">
            <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-foreground font-semibold">
              How we use it
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              To authenticate your identity, personalize your dashboard, and
              associate certificates, artworks, and provenance records with your
              account. We do not use your Google data for advertising.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 rounded-xl bg-white p-6 shadow-sm dark:bg-white/5">
            <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-foreground font-semibold">
              What we never do
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We never sell, share, or rent your personal information to third
              parties. Your Google credentials are never stored — authentication
              is handled entirely by Google and Supabase Auth.
            </p>
          </div>
        </div>

        <p className="text-muted-foreground mt-8 text-center text-sm">
          For full details, read our{' '}
          <Link
            href="/privacy-policy"
            className="text-primary underline underline-offset-4 hover:opacity-80"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

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
