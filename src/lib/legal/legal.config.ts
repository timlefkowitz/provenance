import appConfig from '~/config/app.config';

export type LegalDocumentId = 'privacy' | 'cookies' | 'terms' | 'billing';

export const LEGAL_CONFIG = {
  entityName: 'Provenance Platform',
  contactEmail: 'privacy@provenance.guru',
  siteUrl: appConfig.url,
  lastUpdated: 'June 9, 2026',
} as const;

export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentId, string> = {
  privacy: 'Privacy Policy',
  cookies: 'Cookie Policy',
  terms: 'Terms of Service',
  billing: 'Billing & Refunds',
};
