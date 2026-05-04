import Link from 'next/link';
import type { SiteExhibition } from '../types';

export function SiteExhibitionList({
  exhibitions,
  handle,
}: {
  exhibitions: SiteExhibition[];
  handle: string;
}) {
  if (exhibitions.length === 0) return null;

  return (
    <ul className="divide-y divide-black/8">
      {exhibitions.map((ex) => (
        <li key={ex.id} className="py-5">
          <Link
            href={`/exhibitions/${ex.id}`}
            className="group flex flex-col gap-1"
          >
            <h3
              className="text-sm font-semibold leading-snug transition-opacity group-hover:opacity-70"
              style={{ fontFamily: 'system-ui, sans-serif', color: '#111' }}
            >
              {ex.title}
            </h3>
            <div
              className="text-xs flex flex-wrap gap-x-3 gap-y-0.5"
              style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}
            >
              <span>
                {formatDate(ex.start_date)}
                {ex.end_date ? ` – ${formatDate(ex.end_date)}` : ''}
              </span>
              {ex.location && <span>{ex.location}</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
