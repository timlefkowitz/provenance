import { CERTIFICATE_TYPES } from '~/lib/user-roles';

type CertRow = {
  id: string;
  certificate_type?: string | null;
  source_artwork_id?: string | null;
};

type LinkRow = { artwork_id: string; cos_artwork_id?: string | null };

const MAX_DEPTH = 5;

/**
 * One physical work can be linked into a show through several certificates:
 * the artist's COA plus the Certificate of Show issued from it (or a COS/COO
 * issued from that). Show the work once, as the artist's COA, whenever that
 * COA is among the given rows.
 *
 * Returns the rows to show and, for each certificate left out, the COA id
 * that stands in for it (so callers can carry over e.g. a list price).
 */
export function preferArtistCoa<T extends CertRow>(
  rows: T[],
  links: LinkRow[] = [],
): { rows: T[]; foldedInto: Map<string, string> } {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const isCoa = (id: string | null | undefined) =>
    !!id && byId.get(id)?.certificate_type === CERTIFICATE_TYPES.AUTHENTICITY;

  const foldedInto = new Map<string, string>();

  // The COA's exhibition link records the COS issued for it in this show.
  for (const l of links) {
    const cos = l.cos_artwork_id;
    if (!cos || cos === l.artwork_id || !byId.has(cos) || !isCoa(l.artwork_id)) continue;
    if (isCoa(cos)) continue;
    foldedInto.set(cos, l.artwork_id);
  }

  // Any other certificate issued (directly or through others shown here) from a COA shown here.
  for (const r of rows) {
    if (isCoa(r.id) || foldedInto.has(r.id)) continue;
    let parent = r.source_artwork_id ?? null;
    for (let depth = 0; parent && byId.has(parent) && depth < MAX_DEPTH; depth++) {
      if (isCoa(parent)) {
        foldedInto.set(r.id, parent);
        break;
      }
      parent = byId.get(parent)?.source_artwork_id ?? null;
    }
  }

  return { rows: rows.filter((r) => !foldedInto.has(r.id)), foldedInto };
}
