/**
 * Index Template
 * Swiss typographic archive: strict table of works, minimal decoration.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SiteExhibitionList } from '../_components/site-exhibition-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';
import { resolveAccent, resolveSurface } from './palette';

export function IndexTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color ?? 'white');
  const displayName = site.display_name ?? site.name;

  return (
    <div style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', color: surface.ink, background: surface.bg }}>
      <header className="border-b px-6 py-5 flex items-center justify-between" style={{ borderColor: '#ddd' }}>
        <span className="text-xs uppercase tracking-[0.15em]">{displayName}</span>
        <nav className="flex items-center gap-4">
          {site.sections.artworks && site.artworks.length > 0 && (
            <a href="#works" className="text-[10px] uppercase tracking-widest hover:opacity-50" style={{ color: accentColor }}>Index</a>
          )}
          {site.sections.contact && (
            <a href="#contact" className="text-[10px] uppercase tracking-widest hover:opacity-50" style={{ color: accentColor }}>Contact</a>
          )}
          {site.cta && <SiteCtaButton cta={site.cta} />}
        </nav>
      </header>

      {site.sections.bio && site.bio && (
        <section className="max-w-4xl mx-auto px-6 py-8 border-b" style={{ borderColor: '#eee', fontFamily: 'system-ui, sans-serif' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#666' }}>{site.bio}</p>
        </section>
      )}

      {site.sections.artworks && site.artworks.length > 0 && (
        <section id="works" className="max-w-4xl mx-auto px-6 py-8">
          <div className="grid grid-cols-[2rem_3rem_1fr_4rem] gap-x-4 text-[10px] uppercase tracking-widest pb-3 border-b mb-1" style={{ borderColor: '#ddd', color: accentColor }}>
            <span>#</span>
            <span>Img</span>
            <span>Title</span>
            <span className="text-right">Year</span>
          </div>
          {site.artworks.map((artwork, i) => (
            <Link
              key={artwork.id}
              href={`/works/${artwork.id}`}
              className="grid grid-cols-[2rem_3rem_1fr_4rem] gap-x-4 items-center py-3 border-b hover:bg-black/[0.02] transition-colors group"
              style={{ borderColor: '#eee', fontFamily: 'system-ui, sans-serif' }}
            >
              <span className="text-[10px]" style={{ color: '#aaa' }}>{String(i + 1).padStart(3, '0')}</span>
              <div className="relative w-8 h-8 bg-neutral-100 overflow-hidden flex-shrink-0">
                {artwork.image_url ? (
                  <Image src={artwork.image_url} alt="" fill className="object-cover" unoptimized />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-sm truncate group-hover:opacity-70">{artwork.title}</p>
                <p className="text-[10px] truncate mt-0.5" style={{ color: '#aaa' }}>{artwork.certificate_number}</p>
              </div>
              <span className="text-xs text-right" style={{ color: '#999' }}>
                {new Date(artwork.created_at).getFullYear()}
              </span>
            </Link>
          ))}
        </section>
      )}

      {site.sections.exhibitions && site.exhibitions.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-10 border-t" style={{ borderColor: '#eee', fontFamily: 'system-ui, sans-serif' }}>
          <p className="text-[10px] uppercase tracking-widest mb-6" style={{ color: accentColor }}>Exhibitions</p>
          <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
        </section>
      )}

      {site.sections.contact && (
        <section id="contact" className="max-w-4xl mx-auto px-6 py-10 border-t" style={{ borderColor: '#eee', fontFamily: 'system-ui, sans-serif' }}>
          <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
        </section>
      )}
    </div>
  );
}
