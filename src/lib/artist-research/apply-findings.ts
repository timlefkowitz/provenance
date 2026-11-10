import {
  normalizeYear,
  sanitizeCvEntries,
  sanitizePress,
  type ArtistCvEntry,
  type ArtistDetailFields,
} from '~/lib/artist-details/fields';
import type { NewsPublicationInput } from '~/lib/news-publications';
import type { ResearchFinding } from './parse-artist-research';

/**
 * Fold accepted research findings into a show copy. Facts only fill empty
 * fields (the curator's own text always wins); CV entries and press are
 * appended without duplicates. Sales are provenance records only and never
 * change the bio.
 */
export function applyFindingsToShowCopy(
  show: ArtistDetailFields,
  findings: Pick<ResearchFinding, 'kind' | 'payload' | 'source_url'>[],
): { next: ArtistDetailFields; changed: string[] } {
  const next: ArtistDetailFields = { ...show, cv_entries: [...show.cv_entries], press: [...show.press] };
  const changed = new Set<string>();
  const cv: ArtistCvEntry[] = [];
  const press: NewsPublicationInput[] = [];

  const fill = <K extends 'bio' | 'birth_place' | 'nationality' | 'website'>(key: K, value: string) => {
    if (!next[key] && value.trim()) {
      next[key] = value.trim();
      changed.add(key);
    }
  };

  for (const f of findings) {
    switch (f.kind) {
      case 'bio_fact': {
        const p = f.payload as { field: string; value: string };
        if (p.field === 'summary') fill('bio', p.value);
        else if (p.field === 'birth_place') fill('birth_place', p.value);
        else if (p.field === 'nationality') fill('nationality', p.value);
        else if (p.field === 'website') fill('website', p.value);
        else if (p.field === 'birth_year' || p.field === 'death_year') {
          const y = normalizeYear(p.value);
          if (y && !next[p.field]) {
            next[p.field] = y;
            changed.add(p.field);
          }
        } else if (p.field === 'education') {
          cv.push({ type: 'education', title: p.value, url: f.source_url });
        }
        break;
      }
      case 'article': {
        const p = f.payload as { title: string; publication_name?: string; date?: string };
        press.push({ title: p.title, url: f.source_url, publication_name: p.publication_name, date: p.date });
        break;
      }
      case 'exhibition': {
        const p = f.payload as { title: string; venue?: string; city?: string; year?: string };
        cv.push({ type: 'exhibition', title: p.title, venue: p.venue, city: p.city, year: p.year, url: f.source_url });
        break;
      }
      case 'award': {
        const p = f.payload as { title: string; venue?: string; year?: string };
        cv.push({ type: 'award', title: p.title, venue: p.venue, year: p.year, url: f.source_url });
        break;
      }
      case 'collection': {
        const p = f.payload as { title: string; city?: string; year?: string };
        cv.push({ type: 'collection', title: p.title, city: p.city, year: p.year, url: f.source_url });
        break;
      }
      case 'sale':
        break;
    }
  }

  if (cv.length) {
    const before = next.cv_entries.length;
    next.cv_entries = sanitizeCvEntries([...next.cv_entries, ...cv]);
    if (next.cv_entries.length > before) changed.add('cv_entries');
  }
  if (press.length) {
    const before = next.press.length;
    next.press = sanitizePress([...next.press, ...press]);
    if (next.press.length > before) changed.add('press');
  }
  return { next, changed: [...changed] };
}
