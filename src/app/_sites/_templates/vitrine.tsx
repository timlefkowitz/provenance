/**
 * Vitrine Template
 * Dark exhibition hall: spotlit works with didactic panels.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';
import { resolveAccent } from './palette';

export function VitrineTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const displayName = site.display_name ?? site.name;

  return (
    <div style={{ fontFamily: 'var(--site-font-body, Georgia, "Times New Roman", serif)', color: '#e8e8e8', background: '#0a0a0a' }}>
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          {site.logo_image_url ? (
            <img src={site.logo_image_url} alt={displayName} className="h-6 w-auto object-contain brightness-200" />
          ) : (
            <span className="text-xs uppercase tracking-[0.3em] text-white/50">{displayName}</span>
          )}
          <nav className="flex items-center gap-5">
            {site.sections.artworks && site.artworks.length > 0 && (
              <a href="#works" className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors">Works</a>
            )}
            {site.sections.contact && (
              <a href="#contact" className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors">Contact</a>
            )}
            {site.cta && <SiteCtaButton cta={site.cta} />}
          </nav>
        </div>
      </header>

      {site.sections.bio && site.bio && (
        <section className="max-w-2xl mx-auto px-6 py-14 text-center">
          <p className="text-sm leading-relaxed text-white/60">{site.bio}</p>
        </section>
      )}

      {site.sections.artworks && site.artworks.length > 0 && (
        <section id="works">
          {site.artworks.map((artwork, i) => (
            <article
              key={artwork.id}
              className="min-h-[85vh] flex flex-col md:flex-row items-stretch border-t border-white/5"
            >
              <div className="flex-1 relative min-h-[50vh] md:min-h-0 bg-black flex items-center justify-center p-8 md:p-16">
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at center, ${accentColor}22 0%, transparent 70%)` }}
                />
                <Link href={`/works/${artwork.id}`} className="relative w-full max-w-lg aspect-[3/4] group">
                  {artwork.image_url ? (
                    <Image
                      src={artwork.image_url}
                      alt={artwork.title}
                      fill
                      className="object-contain drop-shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]"
                      unoptimized
                      priority={i < 2}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-white/30">No image</div>
                  )}
                </Link>
              </div>
              <div className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col justify-center px-8 py-12 md:py-0 border-t md:border-t-0 md:border-l border-white/5">
                <p className="text-[10px] uppercase tracking-[0.25em] mb-4" style={{ color: accentColor }}>
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h2 className="text-lg font-normal leading-snug text-white/90">{artwork.title}</h2>
                {artwork.artist_name && (
                  <p className="text-sm mt-2 text-white/50">{artwork.artist_name}</p>
                )}
                <p className="text-xs mt-6 text-white/35 leading-relaxed">
                  {new Date(artwork.created_at).getFullYear()}
                  <br />
                  {artwork.certificate_number}
                </p>
              </div>
            </article>
          ))}
        </section>
      )}

      {site.sections.press && site.press.length > 0 && (
        <section className="border-t border-white/10 max-w-xl mx-auto px-6 py-16">
          <p className="text-[10px] uppercase tracking-[0.25em] mb-8" style={{ color: accentColor }}>Press</p>
          <SitePressList press={site.press} />
        </section>
      )}

      {site.sections.contact && (
        <section id="contact" className="border-t border-white/10 max-w-xl mx-auto px-6 py-16">
          <p className="text-[10px] uppercase tracking-[0.25em] mb-8" style={{ color: accentColor }}>Contact</p>
          <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
        </section>
      )}
    </div>
  );
}
