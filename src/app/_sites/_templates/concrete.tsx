/**
 * Concrete Template
 * Brutalist grid: visible hairline borders, uniform square crops.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SiteExhibitionList } from '../_components/site-exhibition-list';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';
import { resolveAccent, resolveSurface } from './palette';

export function ConcreteTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color ?? 'white');
  const displayName = site.display_name ?? site.name;

  return (
    <div style={{ fontFamily: 'var(--site-font-body, system-ui, -apple-system, sans-serif)', color: surface.ink, background: surface.bg }}>
      <header className="border-b px-6 py-8" style={{ borderColor: '#111' }}>
        <h1 className="text-4xl md:text-6xl font-light lowercase tracking-tight leading-none">
          {displayName}
        </h1>
        {(site.tagline || site.medium) && (
          <p className="text-xs uppercase tracking-[0.3em] mt-4" style={{ color: accentColor }}>
            {site.tagline || site.medium}
          </p>
        )}
        <nav className="flex items-center gap-6 mt-6">
          {site.sections.artworks && site.artworks.length > 0 && (
            <a href="#works" className="text-[10px] uppercase tracking-widest border-b border-current pb-0.5 hover:opacity-50">works</a>
          )}
          {site.sections.exhibitions && site.exhibitions.length > 0 && (
            <a href="#exhibitions" className="text-[10px] uppercase tracking-widest border-b border-current pb-0.5 hover:opacity-50">exhibitions</a>
          )}
          {site.sections.contact && (
            <a href="#contact" className="text-[10px] uppercase tracking-widest border-b border-current pb-0.5 hover:opacity-50">contact</a>
          )}
          {site.cta && <SiteCtaButton cta={site.cta} />}
        </nav>
      </header>

      {site.sections.bio && site.bio && (
        <section className="border-b px-6 py-8 max-w-2xl" style={{ borderColor: '#111' }}>
          <p className="text-sm leading-relaxed" style={{ color: '#444' }}>{site.bio}</p>
        </section>
      )}

      {site.sections.artworks && site.artworks.length > 0 && (
        <section id="works">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {site.artworks.map((artwork) => (
              <Link
                key={artwork.id}
                href={`/works/${artwork.id}`}
                className="group border-r border-b aspect-square relative overflow-hidden"
                style={{ borderColor: '#111' }}
              >
                {artwork.image_url ? (
                  <Image
                    src={artwork.image_url}
                    alt={artwork.title}
                    fill
                    className="object-cover transition-opacity group-hover:opacity-80"
                    unoptimized
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-widest text-neutral-400">
                    no image
                  </div>
                )}
                <div
                  className="absolute inset-x-0 bottom-0 px-2 py-1.5 translate-y-full group-hover:translate-y-0 transition-transform"
                  style={{ background: accentColor }}
                >
                  <p className="text-[10px] text-white truncate uppercase tracking-wide">{artwork.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {site.sections.exhibitions && site.exhibitions.length > 0 && (
        <section id="exhibitions" className="border-t px-6 py-10" style={{ borderColor: '#111' }}>
          <p className="text-[10px] uppercase tracking-[0.3em] mb-6" style={{ color: accentColor }}>exhibitions</p>
          <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
        </section>
      )}

      {site.sections.press && site.press.length > 0 && (
        <section className="border-t px-6 py-10 max-w-xl" style={{ borderColor: '#111' }}>
          <p className="text-[10px] uppercase tracking-[0.3em] mb-6" style={{ color: accentColor }}>press</p>
          <SitePressList press={site.press} />
        </section>
      )}

      {site.sections.contact && (
        <section id="contact" className="border-t px-6 py-10" style={{ borderColor: '#111' }}>
          <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
        </section>
      )}
    </div>
  );
}
