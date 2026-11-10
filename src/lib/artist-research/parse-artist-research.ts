/**
 * Parse the web-search model's answer about an artist into sourced findings.
 * Pure: no network, shared by the server action and tests. Anything without
 * an http(s) source URL is dropped, so every finding can be checked.
 */
import { z } from 'zod';
import { parseJsonLoose } from '~/lib/ai/parse-json-loose';

export const FINDING_KINDS = ['bio_fact', 'article', 'exhibition', 'sale', 'award', 'collection'] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export const BIO_FACT_FIELDS = ['summary', 'birth_year', 'birth_place', 'nationality', 'death_year', 'education', 'website'] as const;
export type BioFactField = (typeof BIO_FACT_FIELDS)[number];

export type BioFactPayload = { field: BioFactField; value: string };
export type ArticlePayload = { title: string; publication_name?: string; date?: string };
export type ExhibitionPayload = { title: string; venue?: string; city?: string; year?: string; solo?: boolean };
export type SalePayload = { title: string; year?: string; venue?: string; price_text?: string; lot?: string };
export type AwardPayload = { title: string; venue?: string; year?: string };
export type CollectionPayload = { title: string; city?: string; year?: string };

export type ResearchFinding =
  | { kind: 'bio_fact'; payload: BioFactPayload; source_url: string; source_title: string | null }
  | { kind: 'article'; payload: ArticlePayload; source_url: string; source_title: string | null }
  | { kind: 'exhibition'; payload: ExhibitionPayload; source_url: string; source_title: string | null }
  | { kind: 'sale'; payload: SalePayload; source_url: string; source_title: string | null }
  | { kind: 'award'; payload: AwardPayload; source_url: string; source_title: string | null }
  | { kind: 'collection'; payload: CollectionPayload; source_url: string; source_title: string | null };

const str = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .optional()
  .nullable();

const Source = { source_url: str, source_title: str };

const ResponseSchema = z.object({
  bio_facts: z.array(z.object({ field: z.string(), value: str, ...Source }).passthrough()).optional().nullable(),
  articles: z
    .array(z.object({ title: str, url: str, publication_name: str, date: str }).passthrough())
    .optional()
    .nullable(),
  exhibitions: z
    .array(z.object({ title: str, venue: str, city: str, year: str, type: str, ...Source }).passthrough())
    .optional()
    .nullable(),
  sales: z
    .array(z.object({ title: str, year: str, venue: str, price: str, lot: str, ...Source }).passthrough())
    .optional()
    .nullable(),
  awards: z.array(z.object({ title: str, venue: str, year: str, ...Source }).passthrough()).optional().nullable(),
  collections: z
    .array(z.object({ title: str, city: str, year: str, ...Source }).passthrough())
    .optional()
    .nullable(),
});

export function cleanSourceUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    // Drop tracking params the search model tends to add.
    for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k);
    return u.href;
  } catch {
    return null;
  }
}

function opt<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    (out as Record<string, unknown>)[k] = typeof v === 'string' ? v.slice(0, 2000) : v;
  }
  return out;
}

const MAX_PER_KIND = 15;

export function parseArtistResearchResponse(content: string): ResearchFinding[] {
  const json = parseJsonLoose(content);
  if (json === null) return [];
  const parsed = ResponseSchema.safeParse(json);
  if (!parsed.success) return [];
  const r = parsed.data;
  const out: ResearchFinding[] = [];
  const seen = new Set<string>();
  const push = (f: ResearchFinding, dedupe: string) => {
    const key = `${f.kind}|${dedupe.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f);
  };

  for (const b of (r.bio_facts ?? []).slice(0, MAX_PER_KIND)) {
    const url = cleanSourceUrl(b.source_url);
    const field = BIO_FACT_FIELDS.find((f) => f === b.field);
    if (!url || !field || !b.value) continue;
    push({ kind: 'bio_fact', payload: { field, value: b.value.slice(0, 2000) }, source_url: url, source_title: b.source_title || null }, `${field}|${b.value}`);
  }
  for (const a of (r.articles ?? []).slice(0, MAX_PER_KIND)) {
    const url = cleanSourceUrl(a.url);
    if (!url || !a.title) continue;
    push(
      { kind: 'article', payload: opt({ title: a.title, publication_name: a.publication_name, date: a.date }) as ArticlePayload, source_url: url, source_title: a.publication_name || null },
      url,
    );
  }
  for (const e of (r.exhibitions ?? []).slice(0, MAX_PER_KIND)) {
    const url = cleanSourceUrl(e.source_url);
    if (!url || !e.title) continue;
    const solo = e.type ? /solo/i.test(e.type) : undefined;
    push(
      { kind: 'exhibition', payload: opt({ title: e.title, venue: e.venue, city: e.city, year: e.year, solo }) as ExhibitionPayload, source_url: url, source_title: e.source_title || null },
      `${e.title}|${e.venue ?? ''}|${e.year ?? ''}`,
    );
  }
  for (const s of (r.sales ?? []).slice(0, MAX_PER_KIND)) {
    const url = cleanSourceUrl(s.source_url);
    if (!url || !s.title) continue;
    push(
      { kind: 'sale', payload: opt({ title: s.title, year: s.year, venue: s.venue, price_text: s.price, lot: s.lot }) as SalePayload, source_url: url, source_title: s.source_title || null },
      `${s.title}|${s.venue ?? ''}|${s.year ?? ''}`,
    );
  }
  for (const a of (r.awards ?? []).slice(0, MAX_PER_KIND)) {
    const url = cleanSourceUrl(a.source_url);
    if (!url || !a.title) continue;
    push({ kind: 'award', payload: opt({ title: a.title, venue: a.venue, year: a.year }) as AwardPayload, source_url: url, source_title: a.source_title || null }, `${a.title}|${a.year ?? ''}`);
  }
  for (const c of (r.collections ?? []).slice(0, MAX_PER_KIND)) {
    const url = cleanSourceUrl(c.source_url);
    if (!url || !c.title) continue;
    push({ kind: 'collection', payload: opt({ title: c.title, city: c.city, year: c.year }) as CollectionPayload, source_url: url, source_title: c.source_title || null }, c.title);
  }
  return out;
}

export function buildArtistResearchPrompt(p: {
  name: string;
  medium?: string | null;
  location?: string | null;
  website?: string | null;
  knownFacts?: string[];
}): string {
  const hints = [
    p.medium ? `works in ${p.medium}` : null,
    p.location ? `based in ${p.location}` : null,
    p.website ? `website ${p.website}` : null,
  ].filter(Boolean);
  const known = (p.knownFacts ?? []).filter(Boolean);
  return `Search the web for public, professional information about the visual artist "${p.name}"${hints.length ? ` (${hints.join('; ')})` : ''}. A museum curator is preparing an exhibition and needs verifiable facts about the artist's career.
${known.length ? `\nKnown details to help find the right person: ${known.join('; ')}.\n` : ''}
Only include information about this artist's art career. Do NOT include home addresses, phone numbers, personal email, family members, health, relationships, or other private life details. If you are not confident a result is about this same artist, leave it out.

Respond with ONE JSON object and nothing else (no prose, no markdown fences). Keys:
- "bio_facts": array of { "field": one of "summary" | "birth_year" | "birth_place" | "nationality" | "death_year" | "education" | "website", "value": string, "source_url": string, "source_title": string }. "summary" is a neutral 2-3 sentence factual bio.
- "articles": array of { "title", "url", "publication_name", "date" } — reviews, interviews, features, news.
- "exhibitions": array of { "title", "venue", "city", "year", "type": "solo" | "group", "source_url", "source_title" } — past shows.
- "sales": array of { "title" (artwork title), "year", "venue" (auction house or gallery), "price" (as published, with currency, e.g. "USD 12,500" or "estimate GBP 3,000–5,000"), "lot", "source_url", "source_title" } — public auction results or published sales.
- "awards": array of { "title", "venue" (awarding body), "year", "source_url", "source_title" } — awards, grants, residencies.
- "collections": array of { "title" (institution), "city", "year", "source_url", "source_title" } — public or museum collections holding the artist's work.

Every item MUST have a real https source URL you found via web search. Up to 10 items per array. Use empty arrays when nothing is found.`;
}
