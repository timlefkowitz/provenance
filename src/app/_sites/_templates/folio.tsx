/**
 * Folio Template
 * Narrow centered column — one work after another, book-like rhythm.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';
import { OrderedSections } from '../_components/ordered-sections';
import { EditableText } from '../_components/editable-text';
import { EditableImage } from '../_components/editable-image';
import { EditableCta } from '../_components/editable-cta';
import { resolveAccent, resolveSurface } from './palette';

export function FolioTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color ?? 'cream');

  return (
    <div style={{ fontFamily: 'var(--site-font-body, Georgia, "Times New Roman", serif)', color: surface.ink, background: surface.bg }}>
      <header className="max-w-md mx-auto px-6 pt-16 pb-10 text-center">
        {site.logo_image_url ? (
          <EditableImage field="logo">
            <Image src={site.logo_image_url} alt={site.display_name ?? site.name} width={0} height={0} sizes="100vw" className="h-8 w-auto object-contain mx-auto mb-4" />
          </EditableImage>
        ) : (
          <h1 className="text-xl font-normal tracking-wide">
            <EditableText field="display_name" value={site.display_name ?? site.name} placeholder="Your name" as="span" />
          </h1>
        )}
        <EditableText field="tagline" value={site.tagline} placeholder="Your tagline…" as="p" className="text-xs mt-2 italic" style={{ color: '#888' }} />
        <nav className="flex items-center justify-center gap-5 mt-8">
          {site.sections.artworks && site.artworks.length > 0 && <a href="#works" className="text-[10px] uppercase tracking-[0.2em] hover:opacity-60" style={{ color: accentColor }}>Works</a>}
          {site.sections.contact && <a href="#contact" className="text-[10px] uppercase tracking-[0.2em] hover:opacity-60" style={{ color: accentColor }}>Contact</a>}
          {site.cta && <EditableCta cta={site.cta}><SiteCtaButton cta={site.cta} /></EditableCta>}
        </nav>
      </header>

      <OrderedSections
        order={site.section_order}
        sections={site.sections}
        accentColor={accentColor}
        slots={{
          bio: site.bio ? (
            <section className="max-w-md mx-auto px-6 pb-14">
              <EditableText field="bio" value={site.bio} placeholder="Write a short bio…" as="p" className="text-sm leading-[1.8] text-center" style={{ color: '#555' }} />
            </section>
          ) : undefined,

          artworks: site.artworks.length > 0 ? (
            <section id="works" className="max-w-md mx-auto px-6">
              {site.artworks.map((artwork, i) => (
                <article key={artwork.id} className="mb-20 last:mb-0">
                  <Link href={`/works/${artwork.id}`} className="group block">
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-100">
                      {artwork.image_url ? (
                        <Image src={artwork.image_url} alt={artwork.title} fill className="object-cover transition-opacity duration-500 group-hover:opacity-90" unoptimized priority={i < 2} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">No image</div>
                      )}
                    </div>
                    <figcaption className="mt-5 text-center">
                      <p className="text-sm italic">{artwork.title}</p>
                      <p className="text-[10px] uppercase tracking-[0.15em] mt-2" style={{ color: '#aaa' }}>{new Date(artwork.created_at).getFullYear()}</p>
                    </figcaption>
                  </Link>
                </article>
              ))}
            </section>
          ) : undefined,

          exhibitions: site.exhibitions.length > 0 ? (
            <section className="max-w-md mx-auto px-6 py-16 mt-10 border-t" style={{ borderColor: '#e8e8e8' }}>
              <p className="text-[10px] uppercase tracking-[0.2em] mb-6 text-center" style={{ color: accentColor }}>Exhibitions</p>
              <div className="space-y-4">
                {site.exhibitions.map((ex) => (
                  <div key={ex.id}>
                    <p className="text-sm" style={{ color: '#111' }}>{ex.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#aaa' }}>{new Date(ex.start_date).getFullYear()}{ex.location ? ` · ${ex.location}` : ''}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : undefined,

          press: site.press.length > 0 ? (
            <section className="max-w-md mx-auto px-6 py-16 mt-10 border-t" style={{ borderColor: '#e8e8e8' }}>
              <p className="text-[10px] uppercase tracking-[0.2em] mb-6 text-center" style={{ color: accentColor }}>Press</p>
              <SitePressList press={site.press} />
            </section>
          ) : undefined,

          contact: (
            <section id="contact" className="max-w-md mx-auto px-6 py-16 text-center border-t" style={{ borderColor: '#e8e8e8' }}>
              <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
            </section>
          ),
        }}
      />
    </div>
  );
}
