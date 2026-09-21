import { SOURCE_LABELS, type ArtistLead } from '~/app/portal/or/_actions/leads-constants';

/** Filter value meaning "every source". */
export const ALL_SOURCES = '__all__';
/** Filter value for contacts with no recorded source. */
export const NO_SOURCE = '__none__';

export type SortKey = 'name' | 'source';
export type SortDir = 'asc' | 'desc';

export function sourceLabel(source: string | null): string {
  if (!source) return 'Unknown';
  return SOURCE_LABELS[source] ?? source.replace(/_/g, ' ');
}

export function displayName(lead: ArtistLead): string {
  return lead.contact_name?.trim() || lead.contact_email || 'No name';
}

const sourceKey = (lead: ArtistLead): string => lead.source?.trim() || NO_SOURCE;

/** Contacts that can actually be mailed or named; mirrors what the table shows. */
export function visibleContacts(contacts: ArtistLead[]): ArtistLead[] {
  return contacts.filter((c) => c.contact_name?.trim() || c.contact_email?.trim());
}

/** Distinct sources present in the list with counts, most common first. */
export function sourceOptions(contacts: ArtistLead[]): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of visibleContacts(contacts)) {
    const key = sourceKey(c);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: value === NO_SOURCE ? 'Unknown' : sourceLabel(value),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function filterAndSortContacts(
  contacts: ArtistLead[],
  opts: { query: string; source: string; sortKey: SortKey; sortDir: SortDir },
): ArtistLead[] {
  let list = visibleContacts(contacts);

  if (opts.source !== ALL_SOURCES) {
    list = list.filter((c) => sourceKey(c) === opts.source);
  }

  const q = opts.query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (c) =>
        c.contact_name?.toLowerCase().includes(q) ||
        c.contact_email?.toLowerCase().includes(q) ||
        c.contact_phone?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q) ||
        sourceLabel(c.source).toLowerCase().includes(q),
    );
  }

  const dir = opts.sortDir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (opts.sortKey === 'source') {
      // Unknown sources always sort last regardless of direction.
      if (!a.source !== !b.source) return a.source ? -1 : 1;
      const bySource = sourceLabel(a.source).localeCompare(sourceLabel(b.source));
      if (bySource !== 0) return bySource * dir;
    }
    return displayName(a).localeCompare(displayName(b)) * (opts.sortKey === 'name' ? dir : 1);
  });
}
