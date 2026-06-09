/**
 * Pavilion Template
 * Biennale pavilion: oversized poster typography, exhibitions-first.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SiteExhibitionList } from '../_components/site-exhibition-list';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';
import { resolveAccent, resolveSurface } from './palette';

export function PavilionTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color ?? 'white');
  const displayName = site.display_name ?? site.name;
  const heroBg = site.hero_image_url ?? site.exhibitions[0]?.image_url ?? site.artworks[0]?.image_url;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: surface.ink, background: surface.bg }}>
      <section className="relative min-h-[60vh] flex flex-col justify-end overflow-hidden" style={{ background: accentColor }}>
        {heroBg && (
          <div className="absolute inset-0">
            <Image src={heroBg} alt={displayName} fill className="object-cover opacity-30 mix-blend-luminosity" unoptimized priority />
          </div>
        )}
        <div className="relative z-10 px-6 md:px-12 pb-12 pt-32">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/50 mb-4">
            {site.tagline || site.medium || 'Current Exhibition'}
          </p>
          <h1
            className="text-5xl md:text-8xl font-black uppercase leading-[0.9] tracking-tighter text-white"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {displayName}
          </h1>
          {site.location && (
            <p className="text-sm mt-6 text-white/60 uppercase tracking-widest">{site.location}</p>
          )}
        </div>
      </section>

      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur-sm" style={{ borderColor: '#eee' }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>{displayName}</span>
          <nav className="flex items-center gap-5">
            {site.sections.exhibitions && site.exhibitions.length > 0 && (
              <a href="#exhibitions" className="text-[10px] uppercase tracking-widest hover:opacity-60" style={{ color: '#555' }}>Exhibitions</a>
            )}
            {site.sections.artworks && site.artworks.length > 0 && (
              <a href="#works" className="text-[10px] uppercase tracking-widest hover:opacity-60" style={{ color: '#555' }}>Works</a>
            )}
            {site.sections.contact && (
              <a href="#contact" className="text-[10px] uppercase tracking-widest hover:opacity-60" style={{ color: '#555' }}>Contact</a>
            )}
            {site.cta && <SiteCtaButton cta={site.cta} />}
          </nav>
        </div>
      </header>

      {site.sections.bio && site.bio && (
        <section className="max-w-3xl mx-auto px-6 py-14">
          <p className="text-base leading-relaxed" style={{ color: '#444' }}>{site.bio}</p>
        </section>
      )}

      {site.sections.exhibitions && site.exhibitions.length > 0 && (
        <section id="exhibitions" className="border-t" style={{ borderColor: '#eee' }}>
          <div className="max-w-6xl mx-auto px-6 py-14">
            <h2 className="text-4xl font-black uppercase tracking-tight mb-10" style={{ color: accentColor }}>Exhibitions</h2>
            <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
          </div>
        </section>
      )}

      {site.sections.artworks && site.artworks.length > 0 && (
        <section id="works" className="border-t" style={{ borderColor: '#eee' }}>
          <div className="max-w-6xl mx-auto px-6 py-14">
            <h2 className="text-4xl font-black uppercase tracking-tight mb-10" style={{ color: accentColor }}>Works</h2>
            <ol className="divide-y" style={{ borderColor: '#eee' }}>
              {site.artworks.map((artwork, i) => (
                <li key={artwork.id} className="py-6 flex items-center gap-6 group">
                  <span className="text-3xl font-black w-12 flex-shrink-0" style={{ color: `${accentColor}44` }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Link href={`/works/${artwork.id}`} className="flex items-center gap-6 flex-1 min-w-0">
                    {artwork.image_url && (
                      <div className="relative w-16 h-16 flex-shrink-0 overflow-hidden bg-neutral-100">
                        <Image src={artwork.image_url} alt={artwork.title} fill className="object-cover" unoptimized />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold truncate group-hover:opacity-70 transition-opacity">{artwork.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#999' }}>
                        {new Date(artwork.created_at).getFullYear()} · {artwork.certificate_number}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {site.sections.press && site.press.length > 0 && (
        <section className="border-t max-w-3xl mx-auto px-6 py-14" style={{ borderColor: '#eee' }}>
          <h2 className="text-2xl font-black uppercase tracking-tight mb-8" style={{ color: accentColor }}>Press</h2>
          <SitePressList press={site.press} />
        </section>
      )}

      {site.sections.contact && (
        <section id="contact" className="border-t max-w-3xl mx-auto px-6 py-14" style={{ borderColor: '#eee' }}>
          <h2 className="text-2xl font-black uppercase tracking-tight mb-8" style={{ color: accentColor }}>Contact</h2>
          <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
        </section>
      )}
    </div>
  );
}
