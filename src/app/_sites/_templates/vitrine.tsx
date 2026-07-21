/**
 * Vitrine Template
 * Dark exhibition hall: spotlit works with didactic panels.
 */
import Image from 'next/image';
import type { SiteData } from '../types';
import { SiteArtworkLink } from '../_components/site-artwork-runtime';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';
import { OrderedSections } from '../_components/ordered-sections';
import { EditableText } from '../_components/editable-text';
import { EditableImage } from '../_components/editable-image';
import { EditableCta } from '../_components/editable-cta';
import { resolveAccent } from './palette';

export function VitrineTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);

  return (
    <div style={{ fontFamily: 'var(--site-font-body, Georgia, "Times New Roman", serif)', color: '#e8e8e8', background: '#0a0a0a' }}>
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          {site.logo_image_url ? (
            <EditableImage field="logo">
              <Image src={site.logo_image_url} alt={site.display_name ?? site.name} width={0} height={0} sizes="100vw" className="h-6 w-auto object-contain brightness-200" />
            </EditableImage>
          ) : (
            <EditableText field="display_name" value={site.display_name ?? site.name} placeholder="Your name" as="span" className="text-xs uppercase tracking-[0.3em] text-white/50" />
          )}
          <nav className="flex items-center gap-5">
            {site.sections.artworks && site.artworks.length > 0 && <a href="#works" className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors">Works</a>}
            {site.sections.contact && <a href="#contact" className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors">Contact</a>}
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
            <section className="max-w-2xl mx-auto px-6 py-14 text-center">
              <EditableText field="bio" value={site.bio} placeholder="Write a short bio…" as="p" className="text-sm leading-relaxed text-white/60" />
            </section>
          ) : undefined,

          artworks: site.artworks.length > 0 ? (
            <section id="works">
              {site.artworks.map((artwork, i) => (
                <article key={artwork.id} className="min-h-[85vh] flex flex-col md:flex-row items-stretch border-t border-white/5">
                  <div className="flex-1 relative min-h-[50vh] md:min-h-0 bg-black flex items-center justify-center p-8 md:p-16">
                    <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at center, ${accentColor}22 0%, transparent 70%)` }} />
                    <SiteArtworkLink artwork={artwork} className="relative w-full max-w-lg aspect-[3/4] group">
                      {artwork.image_url ? (
                        <Image src={artwork.image_url} alt={artwork.title} fill className="object-contain drop-shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]" unoptimized priority={i < 2} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-white/30">No image</div>
                      )}
                    </SiteArtworkLink>
                  </div>
                  <div className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col justify-center px-8 py-12 md:py-0 border-t md:border-t-0 md:border-l border-white/5">
                    <p className="text-[10px] uppercase tracking-[0.25em] mb-4" style={{ color: accentColor }}>{String(i + 1).padStart(2, '0')}</p>
                    <h2 className="text-lg font-normal leading-snug text-white/90">{artwork.title}</h2>
                    {artwork.artist_name && <p className="text-sm mt-2 text-white/50">{artwork.artist_name}</p>}
                    <p className="text-xs mt-6 text-white/35 leading-relaxed">{new Date(artwork.created_at).getFullYear()}<br />{artwork.certificate_number}</p>
                  </div>
                </article>
              ))}
            </section>
          ) : undefined,

          exhibitions: site.exhibitions.length > 0 ? (
            <section className="border-t border-white/10 max-w-xl mx-auto px-6 py-16">
              <p className="text-[10px] uppercase tracking-[0.25em] mb-8" style={{ color: accentColor }}>Exhibitions</p>
              <div className="space-y-4">
                {site.exhibitions.map((ex) => (
                  <div key={ex.id}>
                    <p className="text-sm text-white/70">{ex.title}</p>
                    <p className="text-[10px] text-white/35 mt-0.5">{new Date(ex.start_date).getFullYear()}{ex.location ? ` · ${ex.location}` : ''}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : undefined,

          press: site.press.length > 0 ? (
            <section className="border-t border-white/10 max-w-xl mx-auto px-6 py-16">
              <p className="text-[10px] uppercase tracking-[0.25em] mb-8" style={{ color: accentColor }}>Press</p>
              <SitePressList press={site.press} />
            </section>
          ) : undefined,

          contact: (
            <section id="contact" className="border-t border-white/10 max-w-xl mx-auto px-6 py-16">
              <p className="text-[10px] uppercase tracking-[0.25em] mb-8" style={{ color: accentColor }}>Contact</p>
              <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
            </section>
          ),
        }}
      />
    </div>
  );
}
