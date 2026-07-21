/**
 * Whitecube Template
 * White-cube gallery: vast whitespace, one centered work per wall, museum wall labels.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SiteExhibitionList } from '../_components/site-exhibition-list';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';
import { OrderedSections } from '../_components/ordered-sections';
import { EditableText } from '../_components/editable-text';
import { EditableImage } from '../_components/editable-image';
import { EditableCta } from '../_components/editable-cta';
import { resolveAccent, resolveSurface } from './palette';

export function WhitecubeTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color ?? 'white');

  return (
    <div style={{ fontFamily: 'var(--site-font-body, Georgia, "Times New Roman", serif)', color: surface.ink, background: surface.bg }}>
      <header className="border-b" style={{ borderColor: '#e8e8e8' }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <EditableText field="display_name" value={site.display_name ?? site.name} placeholder="Your name" as="span" className="text-xs uppercase tracking-[0.35em]" style={{ color: accentColor }} />
          <nav className="flex items-center gap-6">
            {site.sections.artworks && site.artworks.length > 0 && <a href="#works" className="text-[10px] uppercase tracking-[0.25em] hover:opacity-50 transition-opacity" style={{ color: '#999' }}>Works</a>}
            {site.sections.exhibitions && site.exhibitions.length > 0 && <a href="#exhibitions" className="text-[10px] uppercase tracking-[0.25em] hover:opacity-50 transition-opacity" style={{ color: '#999' }}>Exhibitions</a>}
            {site.sections.contact && <a href="#contact" className="text-[10px] uppercase tracking-[0.25em] hover:opacity-50 transition-opacity" style={{ color: '#999' }}>Contact</a>}
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
            <section className="max-w-xl mx-auto px-6 py-16 text-center">
              <EditableText field="bio" value={site.bio} placeholder="Write a short bio…" as="p" className="text-sm leading-relaxed" style={{ color: '#666' }} />
            </section>
          ) : undefined,

          artworks: site.artworks.length > 0 ? (
            <section id="works">
              {site.artworks.map((artwork, i) => (
                <article key={artwork.id} className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-20 border-t" style={{ borderColor: '#eee' }}>
                  <Link href={`/works/${artwork.id}`} className="group block w-full max-w-2xl">
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100">
                      {artwork.image_url ? (
                        <Image src={artwork.image_url} alt={artwork.title} fill className="object-contain transition-opacity duration-500 group-hover:opacity-90" unoptimized priority={i < 2} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">No image</div>
                      )}
                    </div>
                    <div className="mt-8 text-center max-w-md mx-auto">
                      <p className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: accentColor }}>{String(i + 1).padStart(2, '0')}</p>
                      <h2 className="text-sm font-normal italic">{artwork.title}</h2>
                      {artwork.artist_name && <p className="text-xs mt-1" style={{ color: '#888' }}>{artwork.artist_name}</p>}
                      <p className="text-[10px] uppercase tracking-[0.15em] mt-3" style={{ color: '#aaa' }}>{new Date(artwork.created_at).getFullYear()} · {artwork.certificate_number}</p>
                    </div>
                  </Link>
                </article>
              ))}
            </section>
          ) : undefined,

          exhibitions: site.exhibitions.length > 0 ? (
            <section id="exhibitions" className="border-t max-w-3xl mx-auto px-6 py-16" style={{ borderColor: '#eee' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] mb-8 text-center" style={{ color: accentColor }}>Exhibitions</p>
              <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
            </section>
          ) : undefined,

          press: site.press.length > 0 ? (
            <section className="border-t max-w-xl mx-auto px-6 py-16" style={{ borderColor: '#eee' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] mb-8 text-center" style={{ color: accentColor }}>Press</p>
              <SitePressList press={site.press} />
            </section>
          ) : undefined,

          contact: (
            <section id="contact" className="border-t max-w-xl mx-auto px-6 py-16 text-center" style={{ borderColor: '#eee' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] mb-8" style={{ color: accentColor }}>Contact</p>
              <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
            </section>
          ),
        }}
      />
    </div>
  );
}
