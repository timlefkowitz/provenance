/**
 * Reading provenance out of a dropped document or photo of one (COA, invoice,
 * bill of sale, checklist, catalogue page...). The prompt and normalizer are
 * pure so they can be unit tested; the model call lives in the Taco handler.
 */

export const PROVENANCE_DOC_TYPES = [
  'coa',
  'invoice',
  'bill_of_sale',
  'checklist',
  'catalogue',
  'condition_report',
  'appraisal',
  'letter',
  'spreadsheet',
  'other',
] as const;
export type ProvenanceDocType = (typeof PROVENANCE_DOC_TYPES)[number];

export const PROVENANCE_EVENT_TYPES = [
  'ownership',
  'sale',
  'auction',
  'exhibition',
  'publication',
  'authentication',
] as const;
export type ProvenanceEventType = (typeof PROVENANCE_EVENT_TYPES)[number];

export type ExtractedArtwork = {
  /** 0-based index other parts of the result refer to. */
  ref: number;
  title: string;
  artist_name: string | null;
  year: string | null;
  medium: string | null;
  dimensions: string | null;
  edition: string | null;
  price: string | null;
  currency: string | null;
};

export type ExtractedEvent = {
  type: ProvenanceEventType;
  /** Index into artworks; null when the document only covers one work or it's unclear. */
  artwork_ref: number | null;
  date: string | null;
  party: string | null;
  venue: string | null;
  price: string | null;
  currency: string | null;
  notes: string | null;
};

export type ExtractedProvenance = {
  doc_type: ProvenanceDocType;
  summary: string;
  artworks: ExtractedArtwork[];
  events: ExtractedEvent[];
};

export const MAX_EXTRACTED_ARTWORKS = 200;
const MAX_EVENTS = 300;

export const PROVENANCE_EXTRACTION_PROMPT = `You read art-world documents and pull out provenance facts.
The document may be a certificate of authenticity, invoice, bill of sale, receipt, exhibition checklist, price list, catalogue page, auction record, condition report, appraisal, letter, or a spreadsheet export.

Return ONLY a JSON object:
{
  "doc_type": one of ${PROVENANCE_DOC_TYPES.map((t) => `"${t}"`).join(', ')},
  "summary": one sentence describing the document,
  "artworks": [{ "title", "artist_name", "year", "medium", "dimensions", "edition", "price", "currency" }],
  "events": [{ "type": one of ${PROVENANCE_EVENT_TYPES.map((t) => `"${t}"`).join(', ')}, "artwork_ref": index into artworks or null, "date", "party", "venue", "price", "currency", "notes" }]
}

Rules:
- Copy titles, names and numbers exactly as written. Never invent facts; use null for anything not stated.
- "party" is the person or institution involved: the buyer for a sale, the owner for ownership, the issuer for authentication, the publisher for a publication.
- "venue" is the gallery, museum, auction house or publication title.
- Dates as written, or ISO (YYYY or YYYY-MM-DD) when unambiguous.
- price as a plain number string without symbols ("12500"); currency as a code or symbol if shown.
- An invoice or bill of sale is a "sale" event for each work listed. A checklist lists works and is usually one "exhibition" event per work.
- Skip lines that are not artworks (totals, taxes, shipping, headers).`;

function str(v: unknown, max = 300): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s || /^(null|n\/a|none|unknown|-)$/i.test(s)) return null;
  return s.slice(0, max);
}

function priceStr(v: unknown): string | null {
  const s = str(v, 40);
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(/,/g, '.');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

/** Coerces model output into ExtractedProvenance; drops anything malformed. */
export function normalizeExtractedProvenance(raw: unknown): ExtractedProvenance {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const docTypeRaw = str(obj.doc_type, 40)?.toLowerCase().replace(/[\s-]+/g, '_') ?? 'other';
  const doc_type = (PROVENANCE_DOC_TYPES as readonly string[]).includes(docTypeRaw)
    ? (docTypeRaw as ProvenanceDocType)
    : 'other';

  const rawArtworks = Array.isArray(obj.artworks) ? obj.artworks : [];
  // Map from the model's index to ours, since rows without a title are dropped.
  const refMap = new Map<number, number>();
  const artworks: ExtractedArtwork[] = [];
  rawArtworks.forEach((a, i) => {
    if (artworks.length >= MAX_EXTRACTED_ARTWORKS) return;
    const r = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
    const title = str(r.title, 255);
    if (!title) return;
    refMap.set(i, artworks.length);
    artworks.push({
      ref: artworks.length,
      title,
      artist_name: str(r.artist_name ?? r.artist, 255),
      year: str(r.year, 20),
      medium: str(r.medium, 200),
      dimensions: str(r.dimensions, 100),
      edition: str(r.edition, 100),
      price: priceStr(r.price),
      currency: str(r.currency, 8),
    });
  });

  const rawEvents = Array.isArray(obj.events) ? obj.events : [];
  const events: ExtractedEvent[] = [];
  for (const e of rawEvents) {
    if (events.length >= MAX_EVENTS) break;
    const r = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
    const type = str(r.type, 30)?.toLowerCase();
    if (!type || !(PROVENANCE_EVENT_TYPES as readonly string[]).includes(type)) continue;
    const refNum = typeof r.artwork_ref === 'number' ? r.artwork_ref : Number(r.artwork_ref);
    const mapped = Number.isInteger(refNum) ? refMap.get(refNum) : undefined;
    const event: ExtractedEvent = {
      type: type as ProvenanceEventType,
      artwork_ref: mapped ?? (artworks.length === 1 ? 0 : null),
      date: str(r.date, 40),
      party: str(r.party, 200),
      venue: str(r.venue, 200),
      price: priceStr(r.price),
      currency: str(r.currency, 8),
      notes: str(r.notes, 500),
    };
    if (!event.party && !event.venue && !event.date && !event.notes) continue;
    events.push(event);
  }

  return {
    doc_type,
    summary: str(obj.summary, 300) ?? '',
    artworks,
    events,
  };
}

/** One readable provenance line for an event, e.g. "Jane Doe, New York (2004)". */
export function eventToProvenanceLine(e: ExtractedEvent): string {
  const who = [e.party, e.venue].filter(Boolean).join(', ');
  const price = e.price ? ` — ${e.currency ? `${e.currency} ` : ''}${e.price}` : '';
  const date = e.date ? ` (${e.date})` : '';
  const base = who || e.notes || '';
  return `${base}${date}${who ? price : ''}`.trim();
}
