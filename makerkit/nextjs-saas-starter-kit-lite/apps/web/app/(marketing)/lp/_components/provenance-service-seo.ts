import type { Metadata } from 'next';

import appConfig from '~/config/app.config';

const PATH = '/lp/provenance-service' as const;

export const PROVENANCE_SERVICE_SEO = {
  pageTitle:
    'Provenance Research as a Service — End-to-End Art Provenance & Documentation | Provenance',
  description:
    'Institutional-grade provenance research: ownership reconstruction, archive outreach, authenticity signals, and defensible documentation for auction-ready assets.',
  keywords: [
    'provenance research service',
    'art provenance documentation',
    'provenance certificate',
    'auction house provenance',
    'ownership history art',
    'provenance gap analysis',
    'museum provenance records',
    'art authenticity documentation',
    'gallery archive research',
    'institutional provenance diligence',
  ],
} as const;

export const PROVENANCE_SERVICE_FAQS = [
  {
    question: 'What is included in the paid assessment?',
    answer:
      'We review your asset, map known ownership and literature, identify gaps, and return a scoped research plan with timeline and pricing bands before deeper work begins.',
  },
  {
    question: 'How does this differ from provenance software alone?',
    answer:
      'Software organizes what you already know; this service actively researches, contacts archives and stakeholders, and assembles a defensible file comparable to leading auction and museum standards.',
  },
  {
    question: 'Do you conduct outreach to galleries, estates, and auction houses?',
    answer:
      'Yes. Our team manages correspondence, follow-ups, and documentation across dealers, artist foundations, auction archives, private collections, and institutions worldwide.',
  },
  {
    question: 'What types of assets do you support?',
    answer:
      'We focus on high-stakes cultural assets where provenance materially affects salability and value—typically fine art and closely related categories after intake review.',
  },
] as const;

export function buildProvenanceServiceMetadata(): Metadata {
  const canonicalUrl = new URL(PATH, appConfig.url).href;
  const ogImageUrl = new URL(`${PATH}/opengraph-image`, appConfig.url).href;
  const { pageTitle, description, keywords } = PROVENANCE_SERVICE_SEO;

  return {
    title: pageTitle,
    description,
    keywords: [...keywords],
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
      title: pageTitle,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: [ogImageUrl],
    },
  };
}

export function getProvenanceServiceJsonLd() {
  const pageUrl = new URL(PATH, appConfig.url).href;

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: PROVENANCE_SERVICE_SEO.pageTitle,
    description: PROVENANCE_SERVICE_SEO.description,
    url: pageUrl,
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: appConfig.name,
      url: appConfig.url,
    },
  };

  const service = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Provenance research & documentation',
    description: PROVENANCE_SERVICE_SEO.description,
    url: pageUrl,
    provider: {
      '@type': 'Organization',
      name: appConfig.name,
      url: appConfig.url,
    },
    areaServed: 'Worldwide',
    serviceType: [
      'Provenance research',
      'Ownership history documentation',
      'Art authenticity and archival research',
    ],
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: PROVENANCE_SERVICE_FAQS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return [webPage, service, faqPage] as const;
}
