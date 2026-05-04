type Props = {
  name: string;
  website: string | null;
  location: string | null;
  medium: string | null;
};

export function SiteContactBlock({ name, website, location, medium }: Props) {
  return (
    <div className="space-y-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {location && (
        <p className="text-sm" style={{ color: '#555' }}>
          <span className="text-xs uppercase tracking-widest" style={{ color: '#aaa' }}>
            Based in
          </span>{' '}
          {location}
        </p>
      )}
      {medium && (
        <p className="text-sm" style={{ color: '#555' }}>
          <span className="text-xs uppercase tracking-widest" style={{ color: '#aaa' }}>
            Works in
          </span>{' '}
          {medium}
        </p>
      )}
      {website && (
        <p className="text-sm">
          <a
            href={website.startsWith('http') ? website : `https://${website}`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-opacity hover:opacity-60"
            style={{ color: 'var(--site-accent)' }}
          >
            {website.replace(/^https?:\/\//, '')}
          </a>
        </p>
      )}
    </div>
  );
}
