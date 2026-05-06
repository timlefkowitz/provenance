/**
 * Server-only Apify REST helpers (Bearer token from APIFY_API_TOKEN).
 * @see https://docs.apify.com/api/v2
 */

const APIFY_BASE = 'https://api.apify.com/v2';

/**
 * Default “Google Maps Email Extractor” (Poidata) — Maps listings plus scraped site emails.
 * Override with APIFY_LEADS_ACTOR_ID if you use another store Actor with the same name.
 */
export const DEFAULT_LEADS_ACTOR_ID = 'poidata~google-maps-email-extractor';

export function getApifyToken(): string | undefined {
  const t = process.env.APIFY_API_TOKEN?.trim();
  return t || undefined;
}

export function getLeadsActorId(): string {
  return (
    process.env.APIFY_LEADS_ACTOR_ID?.trim() || DEFAULT_LEADS_ACTOR_ID
  ).replace(/\//g, '~');
}

type ApifyListResponse<T> = {
  data?: { items?: T[]; total?: number; count?: number; offset?: number; limit?: number };
  error?: { type: string; message: string };
};

export type ApifyActorRunListItem = {
  id: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  defaultDatasetId?: string;
  actId?: string;
  buildId?: string;
};

export async function apifyFetchJson<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const url = path.startsWith('http') ? path : `${APIFY_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
    next: { revalidate: 0 },
  });

  const body = (await res.json()) as T & { error?: { message?: string } };

  if (!res.ok) {
    const msg =
      (body as { error?: { message?: string } }).error?.message ||
      `Apify HTTP ${res.status}`;
    return { ok: false, status: res.status, message: msg };
  }

  return { ok: true, data: body as T };
}

export type StartRunInput = {
  searchTerms: string[];
  location?: string;
  maxResults?: number;
  language?: string;
};

/**
 * Start an async Actor run with Google Maps Email Extractor–compatible input.
 * Returns the run id and default dataset id immediately (status will be RUNNING).
 */
export async function startActorRun(
  token: string,
  actorId: string,
  input: StartRunInput,
): Promise<
  | { ok: true; run: ApifyActorRunListItem }
  | { ok: false; status?: number; message: string }
> {
  const body = {
    searchStringsArray: input.searchTerms,
    locationQuery: input.location || undefined,
    maxCrawledPlacesPerSearch: input.maxResults ?? 25,
    language: input.language || 'en',
    // Email Extractor specific knobs (safe defaults for most plans).
    maxPagesPerDomain: 5,
    skipClosedPlaces: true,
    scrapeContacts: true,
  };

  const path = `/acts/${encodeURIComponent(actorId)}/runs`;
  const result = await apifyFetchJson<{ data: ApifyActorRunListItem }>(
    path,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!result.ok) {
    console.error('[Apify] startActorRun failed', result.status, result.message);
    return { ok: false, status: result.status, message: result.message };
  }

  const run = result.data.data;
  if (!run?.id) {
    return { ok: false, message: 'Unexpected start-run response' };
  }
  return { ok: true, run };
}

export async function getActorRun(
  token: string,
  runId: string,
): Promise<
  | { ok: true; run: ApifyActorRunListItem }
  | { ok: false; message: string }
> {
  const result = await apifyFetchJson<{ data: ApifyActorRunListItem }>(
    `/actor-runs/${encodeURIComponent(runId)}`,
    token,
  );
  if (!result.ok) {
    console.error('[Apify] getActorRun failed', result.status, result.message);
    return { ok: false, message: result.message };
  }
  const run = result.data.data;
  if (!run?.id) {
    return { ok: false, message: 'Unexpected run response' };
  }
  return { ok: true, run };
}

export async function listActorRuns(
  token: string,
  actorId: string,
  opts?: { limit?: number },
): Promise<
  | { ok: true; items: ApifyActorRunListItem[]; total: number }
  | { ok: false; message: string }
> {
  const q = new URLSearchParams();
  q.set('limit', String(opts?.limit ?? 15));
  q.set('desc', '1');
  const path = `/acts/${encodeURIComponent(actorId)}/runs?${q}`;

  const result = await apifyFetchJson<ApifyListResponse<ApifyActorRunListItem>>(path, token);
  if (!result.ok) {
    console.error('[Apify] listActorRuns failed', result.status, result.message);
    return { ok: false, message: result.message };
  }

  const items = result.data.data?.items ?? [];
  const total = result.data.data?.total ?? items.length;
  return { ok: true, items, total };
}

export async function getDatasetItems(
  token: string,
  datasetId: string,
  opts?: { limit?: number },
): Promise<
  | { ok: true; items: Record<string, unknown>[] }
  | { ok: false; message: string }
> {
  const q = new URLSearchParams();
  q.set('clean', '1');
  q.set('format', 'json');
  q.set('limit', String(opts?.limit ?? 80));
  const path = `/datasets/${encodeURIComponent(datasetId)}/items?${q}`;

  const result = await apifyFetchJson<Record<string, unknown>[]>(path, token);
  if (!result.ok) {
    console.error('[Apify] getDatasetItems failed', result.status, result.message);
    return { ok: false, message: result.message };
  }

  // Dataset items endpoint returns raw array in `data` for json format — check Apify behavior
  const raw = result.data as unknown;
  if (Array.isArray(raw)) {
    return { ok: true, items: raw as Record<string, unknown>[] };
  }

  const wrapped = raw as { data?: Record<string, unknown>[]; items?: Record<string, unknown>[] };
  if (Array.isArray(wrapped?.data)) {
    return { ok: true, items: wrapped.data };
  }
  if (Array.isArray(wrapped?.items)) {
    return { ok: true, items: wrapped.items };
  }

  return { ok: false, message: 'Unexpected dataset response shape' };
}

/** Pick human-readable fields from varied Actor output (Places, directories, etc.). */
export function normalizeLeadRow(row: Record<string, unknown>): {
  title: string;
  subtitle: string;
  url?: string;
  email?: string;
  emails: string[];
  phone?: string;
  address?: string;
} {
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;

  const title =
    str(row.title) ||
    str(row.name) ||
    str(row.placeName) ||
    str(row.company) ||
    'Lead';

  const url =
    str(row.url) ||
    str(row.website) ||
    str(row.websiteUrl) ||
    str(row.domain) ||
    undefined;

  // Collect every email we can find on the row (Email Extractor often nests them).
  const emailSet = new Set<string>();
  const pushEmail = (v: unknown) => {
    const s = str(v);
    if (s && /.+@.+\..+/.test(s)) emailSet.add(s.toLowerCase());
  };

  pushEmail(row.email);
  if (Array.isArray(row.emails)) row.emails.forEach(pushEmail);
  if (Array.isArray((row as { contactEmails?: unknown[] }).contactEmails)) {
    (row as { contactEmails: unknown[] }).contactEmails.forEach(pushEmail);
  }
  if (Array.isArray((row as { contacts?: unknown[] }).contacts)) {
    (row as { contacts: Array<Record<string, unknown>> }).contacts.forEach((c) => {
      pushEmail(c?.email);
      if (Array.isArray(c?.emails)) (c.emails as unknown[]).forEach(pushEmail);
    });
  }

  const emails = Array.from(emailSet);
  const email = emails[0];

  const phone =
    str(row.phone) ||
    str(row.phoneNumber) ||
    str(row.phoneUnformatted) ||
    undefined;

  const address =
    str(row.address) ||
    str(row.fullAddress) ||
    (typeof row.location === 'string' ? row.location : undefined);

  const subtitle = [address, phone].filter(Boolean).join(' · ') || '';

  return { title, subtitle, url, email, emails, phone, address };
}
