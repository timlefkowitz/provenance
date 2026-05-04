import type { SiteCta } from '../types';

export function SiteCtaButton({ cta }: { cta: SiteCta }) {
  return (
    <a
      href={cta.url}
      target="_blank"
      rel="noreferrer"
      className="inline-block px-6 py-3 text-sm font-medium transition-opacity hover:opacity-80"
      style={{
        backgroundColor: 'var(--site-accent)',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        borderRadius: '2px',
        letterSpacing: '0.04em',
      }}
    >
      {cta.label}
    </a>
  );
}
