import type { ArtistCvJson } from '~/lib/grants';
import type { Exhibition } from '~/app/exhibitions/_actions/get-exhibitions';

export type CvExhibitionRow = {
  name: string;
  venue: string | null;
  year: string;
  source: 'cv' | 'provenance';
  /** Only present when source === 'provenance' */
  exhibitionId?: string;
};

/**
 * Merge exhibitions from the uploaded CV JSON with verified Provenance exhibitions.
 *
 * Dedup key: `lowercased(name)|year`
 * When a collision occurs the Provenance entry wins so the badge + link are preserved.
 * Result is sorted by year descending (most recent first).
 */
export function mergeCvExhibitions(
  cvJson: ArtistCvJson | null | undefined,
  provenanceExhibitions: Exhibition[],
): CvExhibitionRow[] {
  const map = new Map<string, CvExhibitionRow>();

  // 1. Seed with uploaded-CV exhibitions first (lower priority)
  for (const ex of cvJson?.exhibitions ?? []) {
    const name = (ex.name ?? '').trim();
    const year = String(ex.year ?? '').trim();
    const venue = (ex.venue ?? '').trim() || null;
    if (!name) continue;

    const key = `${name.toLowerCase()}|${year}`;
    map.set(key, { name, venue, year, source: 'cv' });
  }

  // 2. Overlay Provenance exhibitions — they win on collision
  for (const ex of provenanceExhibitions) {
    const name = ex.title.trim();
    const year = new Date(ex.start_date).getFullYear().toString();
    const venue = (ex.location ?? '').trim() || null;
    const key = `${name.toLowerCase()}|${year}`;

    map.set(key, {
      name,
      venue,
      year,
      source: 'provenance',
      exhibitionId: ex.id,
    });
  }

  const rows = Array.from(map.values());

  // Sort by year descending; fall back to name for ties
  rows.sort((a, b) => {
    const yearDiff = Number(b.year || 0) - Number(a.year || 0);
    if (yearDiff !== 0) return yearDiff;
    return a.name.localeCompare(b.name);
  });

  return rows;
}
