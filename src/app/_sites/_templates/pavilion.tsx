/**
 * Pavilion Template
 * Biennale pavilion: oversized poster typography, exhibitions-first.
 */
import Image from 'next/image';
import type { SiteData } from '../types';
import { SiteArtworkLink } from '../_components/site-artwork-runtime';
import { SiteExhibitionList } from '../_components/site-exhibition-list';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';
import { OrderedSections } from '../_components/ordered-sections';
import { EditableText } from '../_components/editable-text';
import { EditableImage } from '../_components/editable-image';
import { EditableCta } from '../_components/editable-cta';
import { resolveAccent, resolveSurface } from './palette';

export function PavilionTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color ?? 'white');
  const heroBg = site.hero_image_url ?? site.exhibitions[0]?.image_url ?? site.artworks[0]?.image_url;

  return (
    <div style={{ fontFamily: 'var(--site-font-body, system-ui, -apple-system, sans-serif)', color: surface.ink, background: surface.bg }}>
      <section className="relative min-h-[60vh] flex flex-col justify-end overflow-hidden" style={{ background: accentColor }}>
        {heroBg && (
          <EditableImage field="hero">
            <div className="absolute inset-0">
              <Image src={heroBg} alt={site.display_name ?? site.name} fill className="object-cover opacity-30 mix-blend-luminosity" unoptimized priority />
            </div>
          </EditableImage>
        )}
        <div className="relative z-10 px-6 md:px-12 pb-12 pt-32">
          <EditableText
            field="tagline"
            value={site.tagline ?? site.medium ?? 'Current Exhibition'}
            placeholder="Your tagline…"
            as="p"
            className="text-[10px] uppercase tracking-[0.4em] text-white/50 mb-4"
          />
          <h1 className="text-5xl md:text-8xl font-black uppercase leading-[0.9] tracking-tighter text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <EditableText field="display_name" value={site.display_name ?? site.name} placeholder="Your name" as="span" />
          </h1>
          {site.location && <p className="text-sm mt-6 text-white/60 uppercase tracking-widest">{site.location}</p>}
        </div>
      </section>

      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur-sm" style={{ borderColor: '#eee' }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>{site.display_name ?? site.name}</span>
          <nav className="flex items-center gap-5">
            {site.sections.exhibitions && site.exhibitions.length > 0 && <a href="#exhibitions" className="text-[10px] uppercase tracking-widest hover:opacity-60" style={{ color: '#555' }}>Exhibitions</a>}
            {site.sections.artworks && site.artworks.length > 0 && <a href="#works" className="text-[10px] uppercase tracking-widest hover:opacity-60" style={{ color: '#555' }}>Works</a>}
            {site.sections.contact && <a href="#contact" className="text-[10px] uppercase tracking-widest hover:opacity-60" style={{ color: '#555' }}>Contact</a>}
            {site.cta && <EditableCta cta={site.cta}><SiteCtaButton cta={site.cta} /></EditableCta>}
          </nav>
        </div>
      </header>

      <OrderedSections
        order={site.section_order}
        sections={site.sections}
        accentColor={accentColor}
        slots={{
          bio: site.bio ? (
            <section className="max-w-3xl mx-auto px-6 py-14">
              <EditableText field="bio" value={site.bio} placeholder="Write a short bio…" as="p" className="text-base leading-relaxed" style={{ color: '#444' }} />
            </section>
          ) : undefined,

          exhibitions: site.exhibitions.length > 0 ? (
            <section id="exhibitions" className="border-t" style={{ borderColor: '#eee' }}>
              <div className="max-w-6xl mx-auto px-6 py-14">
                <h2 className="text-4xl font-black uppercase tracking-tight mb-10" style={{ color: accentColor }}>Exhibitions</h2>
                <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
              </div>
            </section>
          ) : undefined,

          artworks: site.artworks.length > 0 ? (
            <section id="works" className="border-t" style={{ borderColor: '#eee' }}>
              <div className="max-w-6xl mx-auto px-6 py-14">
                <h2 className="text-4xl font-black uppercase tracking-tight mb-10" style={{ color: accentColor }}>Works</h2>
                <ol className="divide-y" style={{ borderColor: '#eee' }}>
                  {site.artworks.map((artwork, i) => (
                    <li key={artwork.id} className="py-6 flex items-center gap-6 group">
                      <span className="text-3xl font-black w-12 flex-shrink-0" style={{ color: `${accentColor}44` }}>{String(i + 1).padStart(2, '0')}</span>
                      <SiteArtworkLink artwork={artwork} className="flex items-center gap-6 flex-1 min-w-0">
                        {artwork.image_url && (
                          <div className="relative w-16 h-16 flex-shrink-0 overflow-hidden bg-neutral-100">
                            <Image src={artwork.image_url} alt={artwork.title} fill className="object-cover" unoptimized />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold truncate group-hover:opacity-70 transition-opacity">{artwork.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#999' }}>{new Date(artwork.created_at).getFullYear()} · {artwork.certificate_number}</p>
                        </div>
                      </SiteArtworkLink>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ) : undefined,

          press: site.press.length > 0 ? (
            <section className="border-t max-w-3xl mx-auto px-6 py-14" style={{ borderColor: '#eee' }}>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-8" style={{ color: accentColor }}>Press</h2>
              <SitePressList press={site.press} />
            </section>
          ) : undefined,

          contact: (
            <section id="contact" className="border-t max-w-3xl mx-auto px-6 py-14" style={{ borderColor: '#eee' }}>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-8" style={{ color: accentColor }}>Contact</h2>
              <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
            </section>
          ),
        }}
      />
    </div>
  );
}
