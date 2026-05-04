import type { SitePress } from '../types';

export function SitePressList({ press }: { press: SitePress[] }) {
  if (press.length === 0) return null;

  return (
    <ul className="space-y-4">
      {press.map((item, i) => (
        <li key={i}>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="block group"
          >
            <p
              className="text-sm font-medium leading-snug transition-opacity group-hover:opacity-70"
              style={{ fontFamily: 'system-ui, sans-serif', color: '#111' }}
            >
              {item.title}
            </p>
            {(item.publication_name || item.date) && (
              <p
                className="text-xs mt-0.5"
                style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}
              >
                {[item.publication_name, item.date].filter(Boolean).join(' · ')}
              </p>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
