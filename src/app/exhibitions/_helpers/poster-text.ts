/**
 * Editable text on the exhibition QR poster (flyer). Each line has a default
 * built from the exhibition; an override replaces it, and an empty override
 * removes the line. Overrides are saved in `exhibitions.metadata.posterText`
 * so everyone who manages the show prints the same flyer, while lines left
 * alone keep following the exhibition (new dates, a new title).
 */

export const POSTER_FIELDS = [
  { key: 'owner', label: 'Above the title', max: 80 },
  { key: 'title', label: 'Title', max: 160 },
  { key: 'dates', label: 'Dates', max: 100 },
  { key: 'location', label: 'Location', max: 140 },
  { key: 'cta', label: 'Under the code', max: 100 },
  { key: 'sub', label: 'Small print', max: 200 },
  { key: 'url', label: 'Link text', max: 200 },
  { key: 'brand', label: 'Footer', max: 60 },
] as const;

export type PosterField = (typeof POSTER_FIELDS)[number]['key'];
export type PosterText = Record<PosterField, string>;
export type PosterOverrides = Partial<PosterText>;

const MAX = new Map<string, number>(POSTER_FIELDS.map((f) => [f.key, f.max]));

/** Cleans saved overrides: known fields only, strings trimmed to their limit (empty kept: it hides the line). */
export function readPosterOverrides(value: unknown): PosterOverrides {
  if (!value || typeof value !== 'object') return {};
  const out: PosterOverrides = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const max = MAX.get(key);
    if (!max || typeof raw !== 'string') continue;
    out[key as PosterField] = raw.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, max);
  }
  return out;
}

export function resolvePosterText(defaults: PosterText, overrides: PosterOverrides): PosterText {
  const out = { ...defaults };
  for (const { key } of POSTER_FIELDS) {
    const value = overrides[key];
    if (value !== undefined) out[key] = value.trim();
  }
  return out;
}
