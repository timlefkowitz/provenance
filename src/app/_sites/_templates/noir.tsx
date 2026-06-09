/**
 * Noir Template
 * Darkroom portfolio: full-bleed frames on pure black, alternating layouts.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';
import { resolveAccent } from './palette';

export function NoirTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const displayName = site.display_name ?? site.name;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff', background: '#000' }}>
      <header className="px-6 md:px-12 py-10 flex items-end justify-between border-b border-white/10">
        <div>
          <h1 className="text-sm uppercase tracking-[0.35em] text-white/70">{displayName}</h1>
          {site.tagline && (
            <p className="text-xs mt-2 text-white/35">{site.tagline}</p>
          )}
        </div>
        <nav className="flex items-center gap-5">
          {site.sections.artworks && site.artworks.length > 0 && (
            <a href="#works" className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">Works</a>
          )}
          {site.sections.contact && (
            <a href="#contact" className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">Contact</a>
          )}
          {site.cta && <SiteCtaButton cta={site.cta} />}
        </nav>
      </header>

      {site.sections.bio && site.bio && (
        <section className="max-w-xl mx-auto px-6 py-14 text-center">
          <p className="text-sm leading-relaxed text-white/45">{site.bio}</p>
        </section>
      )}

      {site.sections.artworks && site.artworks.length > 0 && (
        <section id="works" className="space-y-24 md:space-y-32 py-12">
          {site.artworks.map((artwork, i) => {
            const isFullBleed = i % 3 === 0;
            const isOffset = i % 3 === 1;

            return (
              <article
                key={artwork.id}
                className={
                  isFullBleed
                    ? 'w-full'
                    : isOffset
                      ? 'max-w-4xl mx-auto px-6 md:px-0 md:ml-[15%] md:mr-[25%]'
                      : 'max-w-3xl mx-auto px-6'
                }
              >
                <Link href={`/works/${artwork.id}`} className="group block">
                  <div
                    className={`relative overflow-hidden bg-neutral-950 ${
                      isFullBleed ? 'aspect-[16/9] w-full' : 'aspect-[4/5] w-full'
                    }`}
                  >
                    {artwork.image_url ? (
                      <Image
                        src={artwork.image_url}
                        alt={artwork.title}
                        fill
                        className="object-cover transition-opacity duration-700 group-hover:opacity-85"
                        unoptimized
                        priority={i < 2}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-white/20">No image</div>
                    )}
                  </div>
                  <div className={`mt-4 flex items-baseline justify-between gap-4 ${isOffset ? 'md:pl-4' : ''}`}>
                    <p className="text-xs text-white/60">{artwork.title}</p>
                    <p className="text-[10px] text-white/25 flex-shrink-0">
                      {new Date(artwork.created_at).getFullYear()}
                    </p>
                  </div>
                </Link>
              </article>
            );
          })}
        </section>
      )}

      {site.sections.press && site.press.length > 0 && (
        <section className="max-w-xl mx-auto px-6 py-16 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-[0.25em] mb-8" style={{ color: accentColor }}>Press</p>
          <SitePressList press={site.press} />
        </section>
      )}

      {site.sections.contact && (
        <footer id="contact" className="border-t border-white/10 px-6 py-16 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-8">
            {displayName} · Photographer
          </p>
          <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
        </footer>
      )}
    </div>
  );
}
