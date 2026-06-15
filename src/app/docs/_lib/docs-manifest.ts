export type DocGroup = 'guide' | 'api';

export type DocEntry = {
  /** Path segment after /docs/ (e.g. getting-started, api/verify) */
  slug: string;
  title: string;
  description: string;
  order: number;
  group: DocGroup;
};

export const DOC_SECTIONS: { id: DocGroup; label: string }[] = [
  { id: 'guide', label: 'user guide' },
  { id: 'api', label: 'api reference' },
];

export const DOC_ENTRIES: DocEntry[] = [
  // User guide
  {
    slug: 'getting-started',
    title: 'Getting started',
    description: 'Create an account, choose your role, and explore the platform.',
    order: 1,
    group: 'guide',
  },
  {
    slug: 'accounts-and-roles',
    title: 'Accounts & roles',
    description: 'Artist, collector, and gallery roles and permissions.',
    order: 2,
    group: 'guide',
  },
  {
    slug: 'artworks-and-collection',
    title: 'Artworks & collection',
    description: 'Add, organize, and manage your artwork records.',
    order: 3,
    group: 'guide',
  },
  {
    slug: 'certificates-and-provenance',
    title: 'Certificates & provenance',
    description: 'COAs, provenance chains, QR codes, and claims.',
    order: 4,
    group: 'guide',
  },
  {
    slug: 'artists-and-profiles',
    title: 'Artists & profiles',
    description: 'Public profiles, gallery teams, and the artist registry.',
    order: 5,
    group: 'guide',
  },
  {
    slug: 'creator-websites',
    title: 'Creator websites',
    description: 'Publish a microsite on your handle or custom domain.',
    order: 6,
    group: 'guide',
  },
  {
    slug: 'exhibitions',
    title: 'Exhibitions',
    description: 'Plan shows, invite artists, and publish exhibition pages.',
    order: 7,
    group: 'guide',
  },
  {
    slug: 'open-calls',
    title: 'Open calls',
    description: 'Browse and submit to open calls for artists.',
    order: 8,
    group: 'guide',
  },
  {
    slug: 'grants',
    title: 'Grants',
    description: 'Find funding opportunities with CV upload and AI assistant.',
    order: 9,
    group: 'guide',
  },
  {
    slug: 'crm',
    title: 'CRM',
    description: 'Track collectors, leads, and relationships.',
    order: 10,
    group: 'guide',
  },
  {
    slug: 'mailing-list',
    title: 'Mailing list',
    description: 'Manage contacts and email outreach.',
    order: 11,
    group: 'guide',
  },
  {
    slug: 'operations',
    title: 'Operations',
    description: 'Loans, consignments, invoices, and logistics.',
    order: 12,
    group: 'guide',
  },
  {
    slug: 'billing',
    title: 'Billing',
    description: 'Subscriptions, plans, and Stripe billing portal.',
    order: 13,
    group: 'guide',
  },
  // API reference
  {
    slug: 'api/overview',
    title: 'Overview',
    description: 'Verification API introduction and base URL.',
    order: 1,
    group: 'api',
  },
  {
    slug: 'api/authentication',
    title: 'Authentication',
    description: 'Bearer tokens, key scopes, and rate limits.',
    order: 2,
    group: 'api',
  },
  {
    slug: 'api/planets',
    title: 'Planets',
    description: 'Verticals: artworks, collectibles, real estate, vehicles.',
    order: 3,
    group: 'api',
  },
  {
    slug: 'api/verify',
    title: 'Verify asset',
    description: 'POST /api/v1/verify — run verification on an asset.',
    order: 4,
    group: 'api',
  },
  {
    slug: 'api/get-asset',
    title: 'Get asset',
    description: 'GET /api/v1/assets/{planet}/{id}',
    order: 5,
    group: 'api',
  },
  {
    slug: 'api/asset-history',
    title: 'Asset history',
    description: 'GET /api/v1/assets/{planet}/{id}/history',
    order: 6,
    group: 'api',
  },
  {
    slug: 'api/create-asset',
    title: 'Create asset',
    description: 'POST /api/v1/assets/{planet}',
    order: 7,
    group: 'api',
  },
  {
    slug: 'api/certificates',
    title: 'Certificates',
    description: 'GET /api/v1/certificates/{number}',
    order: 8,
    group: 'api',
  },
  {
    slug: 'api/webhooks',
    title: 'Webhooks',
    description: 'POST /api/v1/webhooks — register event notifications.',
    order: 9,
    group: 'api',
  },
  {
    slug: 'api/errors',
    title: 'Errors',
    description: 'HTTP status codes and error response format.',
    order: 10,
    group: 'api',
  },
];

export function docHref(slug: string): string {
  return `/docs/${slug}`;
}

export function getDocsByGroup(group: DocGroup): DocEntry[] {
  return DOC_ENTRIES.filter((d) => d.group === group).sort((a, b) => a.order - b.order);
}

export function getDocEntry(slug: string): DocEntry | undefined {
  return DOC_ENTRIES.find((d) => d.slug === slug);
}

export function getAdjacentDocs(slug: string): {
  prev: DocEntry | null;
  next: DocEntry | null;
} {
  const entry = getDocEntry(slug);
  if (!entry) return { prev: null, next: null };

  const groupDocs = getDocsByGroup(entry.group);
  const idx = groupDocs.findIndex((d) => d.slug === slug);
  return {
    prev: idx > 0 ? groupDocs[idx - 1]! : null,
    next: idx >= 0 && idx < groupDocs.length - 1 ? groupDocs[idx + 1]! : null,
  };
}

export function getAllDocSlugs(): string[] {
  return DOC_ENTRIES.map((d) => d.slug);
}
