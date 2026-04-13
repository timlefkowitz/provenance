import type { Metadata } from 'next';

import appConfig from '~/config/app.config';

import {
  PERSONA_LANDING_PAGES,
  type PersonaLandingConfig,
} from './persona-landing-data';

export const PERSONA_LANDING_PATHS = [
  '/lp/artist',
  '/lp/collector',
  '/lp/gallery',
  '/lp/institution',
] as const;

export function buildPersonaLandingMetadata(
  slug: PersonaLandingConfig['slug'],
): Metadata {
  const c = PERSONA_LANDING_PAGES[slug];
  const path = `/lp/${slug}`;
  const canonicalUrl = new URL(path, appConfig.url).href;
  const ogImageUrl = new URL(`${path}/opengraph-image`, appConfig.url).href;

  return {
    title: c.seo.pageTitle,
    description: c.seo.description,
    keywords: c.seo.keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      siteName: appConfig.name,
      title: c.seo.pageTitle,
      description: c.seo.description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: c.seo.pageTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: c.seo.pageTitle,
      description: c.seo.description,
      images: [ogImageUrl],
    },
  };
}

export function getPersonaJsonLd(slug: PersonaLandingConfig['slug']) {
  const c = PERSONA_LANDING_PAGES[slug];
  const pageUrl = new URL(`/lp/${slug}`, appConfig.url).href;

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: c.seo.pageTitle,
    description: c.seo.description,
    url: pageUrl,
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: appConfig.name,
      url: appConfig.url,
    },
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return [webPage, faqPage] as const;
}
