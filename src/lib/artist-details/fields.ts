/**
 * Artist details a curator can edit for a show (the "show copy") and send to
 * the artist as a suggestion for their own profile. Pure helpers, shared by
 * server actions and client components.
 */
import type { ArtistCvJson } from '~/lib/grants';
import {
  dedupeNewsPublications,
  normalizeNewsPublicationUrl,
  type NewsPublicationInput,
} from '~/lib/news-publications';

export const CV_ENTRY_TYPES = ['exhibition', 'education', 'award', 'collection', 'residency'] as const;
export type CvEntryType = (typeof CV_ENTRY_TYPES)[number];

export const CV_ENTRY_TYPE_LABELS: Record<CvEntryType, string> = {
  exhibition: 'Exhibition',
  education: 'Education',
  award: 'Award',
  collection: 'Collection',
  residency: 'Residency',
};

export type ArtistCvEntry = {
  type: CvEntryType;
  /** Show name, degree, award, or collecting institution */
  title: string;
  year?: string;
  /** Venue, school, or awarding body */
  venue?: string;
  city?: string;
  url?: string;
};

/** Plain-text fields shared by the show copy and user_profiles. */
export const SCALAR_FIELDS = [
  'bio',
  'artist_statement',
  'picture_url',
  'birth_year',
  'birth_place',
  'nationality',
  'death_year',
  'website',
] as const;
export type ScalarField = (typeof SCALAR_FIELDS)[number];

export const FIELD_LABELS: Record<ScalarField | 'cv_entries' | 'press', string> = {
  bio: 'Bio',
  artist_statement: 'Artist statement',
  picture_url: 'Profile photo',
  birth_year: 'Born (year)',
  birth_place: 'Birthplace',
  nationality: 'Nationality',
  death_year: 'Died (year)',
  website: 'Website',
  cv_entries: 'CV entries',
  press: 'Press',
};

export type ArtistDetailScalars = {
  bio: string | null;
  artist_statement: string | null;
  picture_url: string | null;
  birth_year: number | null;
  birth_place: string | null;
  nationality: string | null;
  death_year: number | null;
  website: string | null;
};

export type ArtistDetailFields = ArtistDetailScalars & {
  cv_entries: ArtistCvEntry[];
  press: NewsPublicationInput[];
};

export const EMPTY_SCALARS: ArtistDetailScalars = {
  bio: null,
  artist_statement: null,
  picture_url: null,
  birth_year: null,
  birth_place: null,
  nationality: null,
  death_year: null,
  website: null,
};

const YEAR_FIELDS = new Set<ScalarField>(['birth_year', 'death_year']);

/** 4-digit year between 1000 and next year, else null. */
export function normalizeYear(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n)) return null;
  const max = new Date().getFullYear() + 1;
  return n >= 1000 && n <= max ? Math.trunc(n) : null;
}

function cleanText(value: unknown, max = 20000): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t ? t.slice(0, max) : null;
}

export function normalizeScalar(field: ScalarField, value: unknown): string | number | null {
  if (YEAR_FIELDS.has(field)) return normalizeYear(value);
  return cleanText(value, field === 'bio' || field === 'artist_statement' ? 20000 : 500);
}

/** Keep only https/http URLs; returns null otherwise. */
export function cleanUrl(value: unknown): string | null {
  const t = cleanText(value, 2000);
  if (!t) return null;
  try {
    const u = new URL(t.startsWith('http') ? t : `https://${t}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

export function sanitizeCvEntries(raw: unknown): ArtistCvEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ArtistCvEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const type = CV_ENTRY_TYPES.includes(r.type as CvEntryType) ? (r.type as CvEntryType) : 'exhibition';
    const title = cleanText(r.title, 300);
    if (!title) continue;
    const entry: ArtistCvEntry = { type, title };
    const year = cleanText(r.year, 20);
    const venue = cleanText(r.venue, 300);
    const city = cleanText(r.city, 200);
    const url = cleanUrl(r.url);
    if (year) entry.year = year;
    if (venue) entry.venue = venue;
    if (city) entry.city = city;
    if (url) entry.url = url;
    const key = cvEntryKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out.slice(0, 200);
}

export function cvEntryKey(e: Pick<ArtistCvEntry, 'type' | 'title' | 'year' | 'venue'>): string {
  const norm = (s?: string) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return [e.type, norm(e.title), norm(e.year), norm(e.venue)].join('|');
}

export function sanitizePress(raw: unknown): NewsPublicationInput[] {
  if (!Array.isArray(raw)) return [];
  const out: NewsPublicationInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const title = cleanText(r.title, 300);
    const url = cleanUrl(r.url);
    if (!title || !url) continue;
    const p: NewsPublicationInput = { title, url };
    const pub = cleanText(r.publication_name, 200);
    const date = cleanText(r.date, 20);
    if (pub) p.publication_name = pub;
    if (date) p.date = date;
    out.push(p);
  }
  return dedupeNewsPublications(out).slice(0, 100);
}

/** Museum label line, e.g. "Nigerian, b. 1984, Lagos" or "American, 1920–1990". */
export function formatTombstone(d: {
  birth_year?: number | null;
  birth_place?: string | null;
  nationality?: string | null;
  death_year?: number | null;
}): string {
  const parts: string[] = [];
  if (d.nationality?.trim()) parts.push(d.nationality.trim());
  if (d.birth_year && d.death_year) parts.push(`${d.birth_year}–${d.death_year}`);
  else if (d.birth_year) parts.push(`b. ${d.birth_year}`);
  if (d.birth_place?.trim()) parts.push(d.birth_place.trim());
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// CV <-> user_profiles.artist_cv_json

type CvJsonEntry = { name?: string; venue?: string; year?: string | number; institution?: string; degree?: string; url?: string; city?: string };

const CV_JSON_KEYS: Record<Exclude<CvEntryType, 'education'>, string> = {
  exhibition: 'exhibitions',
  award: 'awards',
  collection: 'collections',
  residency: 'residencies',
};

/** Read an artist's existing CV JSON as flat entries (for diffing). */
export function cvEntriesFromCvJson(cv: ArtistCvJson | null | undefined): ArtistCvEntry[] {
  if (!cv || typeof cv !== 'object') return [];
  const out: ArtistCvEntry[] = [];
  for (const e of (cv.education ?? []) as CvJsonEntry[]) {
    const title = e.degree || e.institution;
    if (!title) continue;
    out.push({ type: 'education', title: String(title), venue: e.degree ? e.institution : undefined, year: e.year ? String(e.year) : undefined });
  }
  for (const [type, key] of Object.entries(CV_JSON_KEYS) as [CvEntryType, string][]) {
    const arr = (cv as Record<string, unknown>)[key];
    if (!Array.isArray(arr)) continue;
    for (const e of arr as CvJsonEntry[]) {
      if (!e?.name) continue;
      out.push({ type, title: String(e.name), venue: e.venue, year: e.year ? String(e.year) : undefined, city: e.city, url: e.url });
    }
  }
  return out;
}

/** Append entries to CV JSON, skipping ones already there. */
export function appendCvEntriesToCvJson(cv: ArtistCvJson | null | undefined, entries: ArtistCvEntry[]): ArtistCvJson {
  const next: ArtistCvJson = { ...(cv && typeof cv === 'object' ? cv : {}) };
  const existing = new Set(cvEntriesFromCvJson(next).map(cvEntryKey));
  for (const e of entries) {
    if (existing.has(cvEntryKey(e))) continue;
    existing.add(cvEntryKey(e));
    if (e.type === 'education') {
      next.education = [...(next.education ?? []), { institution: e.venue ?? e.title, degree: e.venue ? e.title : '', year: e.year ?? '' }];
      continue;
    }
    const key = CV_JSON_KEYS[e.type];
    const arr = Array.isArray(next[key]) ? (next[key] as CvJsonEntry[]) : [];
    const row: CvJsonEntry = { name: e.title, venue: e.venue ?? '', year: e.year ?? '' };
    if (e.city) row.city = e.city;
    if (e.url) row.url = e.url;
    next[key] = [...arr, row];
  }
  return next;
}

// ---------------------------------------------------------------------------
// Suggestions

export type ProfileSuggestionFields = Partial<ArtistDetailScalars> & {
  cv_entries_add?: ArtistCvEntry[];
  press_add?: NewsPublicationInput[];
};

export type SuggestionProfileSnapshot = ArtistDetailScalars & {
  artist_cv_json: ArtistCvJson | null;
  news_publications: NewsPublicationInput[] | null;
};

/**
 * What the show copy would change on the artist's profile: scalar fields that
 * are set and differ, plus CV entries and press the profile doesn't have yet.
 * Empty show-copy fields never clear profile fields.
 */
export function buildProfileSuggestion(
  show: Partial<ArtistDetailFields>,
  profile: SuggestionProfileSnapshot,
): ProfileSuggestionFields {
  const out: ProfileSuggestionFields = {};
  for (const f of SCALAR_FIELDS) {
    const next = normalizeScalar(f, show[f]);
    if (next === null) continue;
    const cur = normalizeScalar(f, profile[f]);
    if (next !== cur) (out as Record<string, unknown>)[f] = next;
  }
  const haveCv = new Set(cvEntriesFromCvJson(profile.artist_cv_json).map(cvEntryKey));
  const cvAdd = sanitizeCvEntries(show.cv_entries).filter((e) => !haveCv.has(cvEntryKey(e)));
  if (cvAdd.length) out.cv_entries_add = cvAdd;
  const havePress = new Set((profile.news_publications ?? []).map((p) => normalizeNewsPublicationUrl(p.url)));
  const pressAdd = sanitizePress(show.press).filter((p) => !havePress.has(normalizeNewsPublicationUrl(p.url)));
  if (pressAdd.length) out.press_add = pressAdd;
  return out;
}

export function suggestionFieldKeys(s: ProfileSuggestionFields): (ScalarField | 'cv_entries_add' | 'press_add')[] {
  return (Object.keys(s) as (ScalarField | 'cv_entries_add' | 'press_add')[]).filter((k) => {
    const v = s[k];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null;
  });
}

/**
 * user_profiles update for the accepted parts of a suggestion. `accepted`
 * lists keys of the suggestion the artist kept; `overrides` holds the artist's
 * own edits to scalar fields before accepting.
 */
export function buildProfileUpdateFromSuggestion(
  suggestion: ProfileSuggestionFields,
  profile: Pick<SuggestionProfileSnapshot, 'artist_cv_json' | 'news_publications'>,
  accepted: string[],
  overrides: Partial<Record<ScalarField, unknown>> = {},
): Record<string, unknown> {
  const keep = new Set(accepted);
  const update: Record<string, unknown> = {};
  for (const f of SCALAR_FIELDS) {
    if (!keep.has(f) || suggestion[f] === undefined) continue;
    const value = f in overrides ? overrides[f] : suggestion[f];
    update[f] = normalizeScalar(f, value);
  }
  if (keep.has('cv_entries_add') && suggestion.cv_entries_add?.length) {
    update.artist_cv_json = appendCvEntriesToCvJson(profile.artist_cv_json, sanitizeCvEntries(suggestion.cv_entries_add));
  }
  if (keep.has('press_add') && suggestion.press_add?.length) {
    update.news_publications = dedupeNewsPublications([
      ...(profile.news_publications ?? []),
      ...sanitizePress(suggestion.press_add),
    ]);
  }
  return update;
}
