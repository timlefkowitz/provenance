import appConfig from '~/config/app.config';

export type LegalDocumentId = 'privacy' | 'cookies' | 'terms' | 'billing';

export const LEGAL_CONFIG = {
  entityName: 'Provenance Guru, Inc.',
  contactEmail: 'privacy@provenance.guru',
  siteUrl: appConfig.url,
  lastUpdated: 'August 29, 2026',
} as const;

export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentId, string> = {
  privacy: 'Privacy Policy',
  cookies: 'Cookie Policy',
  terms: 'Terms of Service',
  billing: 'Billing & Refunds',
};

/** Public routes for standalone legal pages (OAuth consent screen, crawlers, direct links). */
export const LEGAL_DOCUMENT_PATHS: Record<LegalDocumentId, string> = {
  privacy: '/privacy-policy',
  cookies: '/cookie-policy',
  terms: '/terms-of-service',
  billing: '/billing-terms',
};

export function getLegalDocumentPath(id: LegalDocumentId): string {
  return LEGAL_DOCUMENT_PATHS[id];
}

export function getLegalDocumentUrl(id: LegalDocumentId): string {
  const base = LEGAL_CONFIG.siteUrl.replace(/\/$/, '');
  return `${base}${LEGAL_DOCUMENT_PATHS[id]}`;
}
