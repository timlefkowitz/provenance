/**
 * Pure helpers for turning an exhibition checklist (price list / work list)
 * into structured rows. Kept free of server/client imports so it can be unit tested.
 */

export type ChecklistArtwork = {
  artistName: string;
  title: string;
  price: string;
  dimensions: string;
};

export type ExhibitionChecklist = {
  exhibitionTitle: string;
  startDate: string;
  endDate: string;
  location: string;
  artworks: ChecklistArtwork[];
};

export const MAX_CHECKLIST_ARTWORKS = 200;

export const CHECKLIST_EXTRACTION_PROMPT = `
You read exhibition checklists, price lists, and wall-label sheets from art galleries.
Return a single JSON object with these exact keys:
- exhibition_title: string | null (the name of the exhibition/show, not the gallery name)
- start_date: string | null (YYYY-MM-DD, only if clearly stated)
- end_date: string | null (YYYY-MM-DD, only if clearly stated)
- location: string | null (venue / gallery and city, if stated)
- artworks: array of {
    artist_name: string | null,
    title: string,
    price: string | null (as written, keep currency symbol, e.g. "$4,500" or "€1.200"; null if "NFS", "sold", or absent),
    dimensions: string | null (as written, e.g. "30 x 40 in")
  }
Rules:
- One entry per artwork, in document order.
- If the artist name appears once as a heading above several works, repeat it on each of those works.
- Do not invent values. Use null when a value is not present or not legible.
- Ignore totals, page numbers, contact details, and medium/edition lines except as context.
Respond with only valid JSON, no markdown.
`.trim();

function str(value: unknown, max: number): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function isoDate(value: unknown): string {
  const s = str(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : '';
}

/** Sanitises the model's JSON into a predictable shape; drops rows without a title. */
export function normalizeChecklist(raw: unknown): ExhibitionChecklist {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rows = Array.isArray(obj.artworks) ? obj.artworks : [];

  const artworks = rows
    .map((row): ChecklistArtwork => {
      const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      return {
        artistName: str(r.artist_name, 200),
        title: str(r.title, 300),
        price: str(r.price, 50),
        dimensions: str(r.dimensions, 100),
      };
    })
    .filter((r) => r.title.length > 0)
    .slice(0, MAX_CHECKLIST_ARTWORKS);

  return {
    exhibitionTitle: str(obj.exhibition_title, 200),
    startDate: isoDate(obj.start_date),
    endDate: isoDate(obj.end_date),
    location: str(obj.location, 200),
    artworks,
  };
}
