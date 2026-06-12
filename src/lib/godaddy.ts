/**
 * GoDaddy Domains API client helpers.
 * Uses OTE (sandbox) when NODE_ENV !== 'production'.
 */

export const DOMAIN_SEARCH_TLDS = ['com', 'net', 'art', 'studio', 'gallery', 'co', 'space'] as const;

export type DomainSearchResult = {
  tld: string;
  domain: string;
  available: boolean;
  definitive: boolean;
  priceUsdCents: number | null;
  renewalPriceUsdCents: number | null;
  periodYears: number | null;
};

type GoDaddyAvailabilityResponse = {
  domain?: string;
  available?: boolean;
  definitive?: boolean;
  price?: number;
  renewalPrice?: number;
  period?: number;
  currency?: string;
};

type GoDaddyBulkAvailabilityResponse = {
  domains?: GoDaddyAvailabilityResponse[];
};

export function getGoDaddyBaseUrl(): string {
  return process.env.NODE_ENV === 'production'
    ? 'https://api.godaddy.com'
    : 'https://api.ote-godaddy.com';
}

export function getGoDaddyAuthHeader(): string | null {
  const isProd = process.env.NODE_ENV === 'production';
  const key = isProd ? process.env.GODADDY_API_KEY : process.env.GODADDY_OTE_API_KEY ?? process.env.GODADDY_API_KEY;
  const secret = isProd
    ? process.env.GODADDY_API_SECRET
    : process.env.GODADDY_OTE_API_SECRET ?? process.env.GODADDY_API_SECRET;

  if (!key || !secret) return null;
  return `sso-key ${key}:${secret}`;
}

export function isGoDaddyConfigured(): boolean {
  return getGoDaddyAuthHeader() !== null;
}

/** GoDaddy prices are in micro-units (1/1,000,000 USD). Stripe uses cents. */
export function godaddyMicroUnitsToUsdCents(microUnits: number | undefined | null): number | null {
  if (microUnits == null || !Number.isFinite(microUnits)) return null;
  return Math.round(microUnits / 10_000);
}

export function formatUsdFromCents(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

export function normalizeDomainLabel(label: string): string | null {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\..+$/, '')
    .replace(/[^a-z0-9-]/g, '');

  if (!normalized || normalized.length < 2 || normalized.length > 63) {
    return null;
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(normalized) && normalized.length > 1) {
    return null;
  }
  return normalized;
}

export function normalizeFullDomain(domain: string): string | null {
  const normalized = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (!normalized || !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

async function godaddyFetch(path: string, init?: RequestInit): Promise<Response> {
  const auth = getGoDaddyAuthHeader();
  if (!auth) {
    throw new Error('GoDaddy API is not configured');
  }

  const url = `${getGoDaddyBaseUrl()}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

function mapAvailabilityRow(row: GoDaddyAvailabilityResponse): DomainSearchResult {
  const domain = row.domain ?? '';
  const tld = domain.includes('.') ? domain.split('.').slice(1).join('.') : '';
  return {
    tld,
    domain,
    available: Boolean(row.available),
    definitive: Boolean(row.definitive),
    priceUsdCents: godaddyMicroUnitsToUsdCents(row.price),
    renewalPriceUsdCents: godaddyMicroUnitsToUsdCents(row.renewalPrice),
    periodYears: row.period ?? null,
  };
}

export async function searchDomainAvailability(label: string): Promise<DomainSearchResult[]> {
  const normalizedLabel = normalizeDomainLabel(label);
  if (!normalizedLabel) {
    throw new Error('Invalid domain name. Use letters, numbers, and hyphens only.');
  }

  const domains = DOMAIN_SEARCH_TLDS.map((tld) => `${normalizedLabel}.${tld}`);

  console.log('[Sites] searchDomainAvailability', { label: normalizedLabel, domains });

  const res = await godaddyFetch('/v1/domains/available?checkType=FAST', {
    method: 'POST',
    body: JSON.stringify(domains),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('[Sites] GoDaddy availability error', body);
    throw new Error((body as { message?: string }).message ?? 'Domain search failed');
  }

  const data = (await res.json()) as GoDaddyBulkAvailabilityResponse;
  const rows = data.domains ?? (Array.isArray(data) ? data : []);

  return rows.map(mapAvailabilityRow);
}

export async function getDomainAvailability(domain: string): Promise<DomainSearchResult | null> {
  const normalized = normalizeFullDomain(domain);
  if (!normalized) return null;

  const res = await godaddyFetch(
    `/v1/domains/available?domain=${encodeURIComponent(normalized)}&checkType=FAST`,
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('[Sites] GoDaddy single availability error', { domain: normalized, body });
    return null;
  }

  const data = (await res.json()) as GoDaddyAvailabilityResponse;
  return mapAvailabilityRow(data);
}

export type GoDaddyRegistrantContact = {
  nameFirst: string;
  nameLast: string;
  email: string;
  phone: string;
  addressMailing: {
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
};

export function getGoDaddyRegistrantContact(): GoDaddyRegistrantContact | null {
  const nameFirst = process.env.GODADDY_REGISTRANT_FIRST_NAME;
  const nameLast = process.env.GODADDY_REGISTRANT_LAST_NAME;
  const email = process.env.GODADDY_REGISTRANT_EMAIL;
  const phone = process.env.GODADDY_REGISTRANT_PHONE;
  const address1 = process.env.GODADDY_REGISTRANT_ADDRESS_1;
  const city = process.env.GODADDY_REGISTRANT_CITY;
  const state = process.env.GODADDY_REGISTRANT_STATE;
  const postalCode = process.env.GODADDY_REGISTRANT_POSTAL_CODE;
  const country = process.env.GODADDY_REGISTRANT_COUNTRY ?? 'US';

  if (!nameFirst || !nameLast || !email || !phone || !address1 || !city || !state || !postalCode) {
    return null;
  }

  return {
    nameFirst,
    nameLast,
    email,
    phone,
    addressMailing: { address1, city, state, postalCode, country },
  };
}

export async function getDomainAgreementKeys(tld: string): Promise<string[]> {
  const res = await godaddyFetch(
    `/v1/domains/agreements?tlds=${encodeURIComponent(tld)}&privacy=true`,
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('[Sites] GoDaddy agreements error', body);
    throw new Error('Failed to fetch domain agreement');
  }

  const data = (await res.json()) as { agreementKey?: string }[];
  return data.map((a) => a.agreementKey).filter(Boolean) as string[];
}

export async function purchaseDomainOnGoDaddy(
  domain: string,
  agreedByIp: string,
): Promise<{ orderId: number; totalUsdCents: number | null }> {
  const contact = getGoDaddyRegistrantContact();
  if (!contact) {
    throw new Error('GoDaddy registrant contact is not configured');
  }

  const tld = domain.split('.').slice(1).join('.');
  const agreementKeys = await getDomainAgreementKeys(tld);
  if (agreementKeys.length === 0) {
    throw new Error('No domain agreement keys returned');
  }

  const payload = {
    domain,
    period: 1,
    renewAuto: true,
    privacy: true,
    consent: {
      agreementKeys,
      agreedBy: agreedByIp,
      agreedAt: new Date().toISOString(),
    },
    contactRegistrant: contact,
    contactAdmin: contact,
    contactTech: contact,
    contactBilling: contact,
  };

  console.log('[Sites] purchaseDomainOnGoDaddy start', { domain });

  const res = await godaddyFetch('/v1/domains/purchase', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('[Sites] GoDaddy purchase error', body);
    throw new Error((body as { message?: string }).message ?? 'Domain purchase failed');
  }

  const data = (await res.json()) as { orderId?: number; total?: number };
  console.log('[Sites] purchaseDomainOnGoDaddy success', { domain, orderId: data.orderId });

  return {
    orderId: data.orderId ?? 0,
    totalUsdCents: godaddyMicroUnitsToUsdCents(data.total),
  };
}

/** Point domain DNS at Vercel (apex A + www CNAME). */
export async function configureGoDaddyDnsForVercel(domain: string): Promise<void> {
  console.log('[Sites] configureGoDaddyDnsForVercel', { domain });

  const apexRes = await godaddyFetch(`/v1/domains/${encodeURIComponent(domain)}/records/A/@`, {
    method: 'PUT',
    body: JSON.stringify([{ data: '76.76.21.21', ttl: 600 }]),
  });

  if (!apexRes.ok) {
    const body = await apexRes.json().catch(() => ({}));
    console.error('[Sites] GoDaddy A record error', body);
    throw new Error('Failed to set apex A record');
  }

  const wwwRes = await godaddyFetch(`/v1/domains/${encodeURIComponent(domain)}/records/CNAME/www`, {
    method: 'PUT',
    body: JSON.stringify([{ data: 'cname.vercel-dns.com.', ttl: 600 }]),
  });

  if (!wwwRes.ok) {
    const body = await wwwRes.json().catch(() => ({}));
    console.error('[Sites] GoDaddy CNAME record error', body);
    throw new Error('Failed to set www CNAME record');
  }

  console.log('[Sites] configureGoDaddyDnsForVercel success', { domain });
}

export async function registerDomainWithVercel(domain: string): Promise<boolean> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    console.error('[Sites] Vercel domain attach not configured');
    throw new Error('Vercel domain attach is not configured');
  }

  const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: domain }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('[Sites] Vercel Domains API error', body);
    throw new Error((body as { error?: { message?: string } }).error?.message ?? 'Vercel domain attach failed');
  }

  const data = (await res.json()) as { verified?: boolean };
  return Boolean(data.verified);
}
