/**
 * Salon Template
 * 19th-century salon hang: dense masonry wall of varied sizes.
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

const SALON_SIZES = [
  'col-span-1 row-span-1',
  'col-span-1 row-span-2',
  'col-span-2 row-span-1',
  'col-span-1 row-span-1',
  'col-span-2 row-span-2',
  'col-span-1 row-span-1',
];

export function SalonTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color ?? 'parchment');

  return (
    <div style={{ fontFamily: 'var(--site-font-body, Georgia, "Times New Roman", serif)', color: surface.ink, background: surface.bg }}>
      <header className="border-y-4 border-double" style={{ borderColor: accentColor }}>
        <div className="max-w-6xl mx-auto px-6 py-8 text-center">
          {site.logo_image_url ? (
            <EditableImage field="logo">
              <Image src={site.logo_image_url} alt={site.display_name ?? site.name} width={0} height={0} sizes="100vw" className="h-10 w-auto object-contain mx-auto mb-3" />
            </EditableImage>
          ) : (
            <h1 className="text-2xl font-normal tracking-wide">
              <EditableText field="display_name" value={site.display_name ?? site.name} placeholder="Your name" as="span" />
            </h1>
          )}
          <EditableText field="tagline" value={site.tagline} placeholder="Your tagline…" as="p" className="text-xs mt-2 italic" style={{ color: '#777' }} />
          <nav className="flex items-center justify-center gap-6 mt-6">
            {site.sections.artworks && site.artworks.length > 0 && <a href="#works" className="text-[10px] uppercase tracking-[0.2em] hover:opacity-60" style={{ color: accentColor }}>Works</a>}
            {site.sections.exhibitions && site.exhibitions.length > 0 && <a href="#exhibitions" className="text-[10px] uppercase tracking-[0.2em] hover:opacity-60" style={{ color: accentColor }}>Exhibitions</a>}
            {site.sections.contact && <a href="#contact" className="text-[10px] uppercase tracking-[0.2em] hover:opacity-60" style={{ color: accentColor }}>Contact</a>}
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
            <section className="max-w-2xl mx-auto px-6 py-10 text-center border-b" style={{ borderColor: `${accentColor}33` }}>
              <EditableText field="bio" value={site.bio} placeholder="Write a short bio…" as="p" className="text-sm leading-relaxed italic" style={{ color: '#555' }} />
            </section>
          ) : undefined,

          artworks: site.artworks.length > 0 ? (
            <section id="works" className="max-w-6xl mx-auto px-4 py-10">
              <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[140px] md:auto-rows-[180px] gap-3">
                {site.artworks.map((artwork, i) => (
                  <Link key={artwork.id} href={`/works/${artwork.id}`} className={`group relative overflow-hidden border bg-neutral-100 ${SALON_SIZES[i % SALON_SIZES.length]}`} style={{ borderColor: `${accentColor}44` }}>
                    {artwork.image_url ? (
                      <Image src={artwork.image_url} alt={artwork.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">No image</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.55)' }}>
                      <p className="text-[10px] text-white truncate">{artwork.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : undefined,

          exhibitions: site.exhibitions.length > 0 ? (
            <section id="exhibitions" className="border-t-4 border-double max-w-4xl mx-auto px-6 py-12" style={{ borderColor: accentColor }}>
              <p className="text-[10px] uppercase tracking-[0.25em] mb-6 text-center" style={{ color: accentColor }}>Exhibitions</p>
              <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
            </section>
          ) : undefined,

          press: site.press.length > 0 ? (
            <section className="max-w-xl mx-auto px-6 py-12">
              <p className="text-[10px] uppercase tracking-[0.25em] mb-6 text-center" style={{ color: accentColor }}>Press</p>
              <SitePressList press={site.press} />
            </section>
          ) : undefined,

          contact: (
            <section id="contact" className="border-t max-w-xl mx-auto px-6 py-12 text-center" style={{ borderColor: `${accentColor}33` }}>
              <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
            </section>
          ),
        }}
      />
    </div>
  );
}
