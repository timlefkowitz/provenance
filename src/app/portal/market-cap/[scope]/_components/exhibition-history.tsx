import Link from 'next/link';

import type { CollectorExhibitionEntry } from '~/lib/collectors/load-collector-exhibition-history';

function formatRange(start: string | null, end: string | null): string | null {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  try {
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return fmt(start);
  } catch {
    return null;
  }
  return null;
}

/** Where works in the collector's collection have been shown. */
export function ExhibitionHistory({
  entries,
  titleById,
}: {
  entries: CollectorExhibitionEntry[];
  titleById: Map<string, string>;
}) {
  return (
    <div className="space-y-2">
      <h2 className="font-serif text-sm font-semibold text-ink/60 uppercase tracking-wide">
        Where your works have been shown
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm font-serif text-ink/50">
          None of your works have been in an exhibition on Provenance yet. We&apos;ll notify you when one is.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map(({ exhibition, artworkIds }) => {
            const range = formatRange(exhibition.start_date, exhibition.end_date);
            return (
              <li
                key={exhibition.id}
                className="rounded-lg border border-wine/10 bg-parchment/40 px-4 py-3"
              >
                <Link href={`/exhibitions/${exhibition.id}`} className="font-serif font-semibold text-ink hover:text-wine">
                  {exhibition.title}
                </Link>
                {(range || exhibition.location) && (
                  <p className="text-xs font-serif text-ink/50 mt-0.5">
                    {[range, exhibition.location].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="text-xs font-serif text-ink/70 mt-1">
                  {artworkIds.map((id) => titleById.get(id) ?? 'Untitled').join(', ')}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
