/**
 * Shopfront Template
 * Shrig Shop-inspired: chunky sticky nav, welcome blurb, product-card grid
 * with rounded borders, prices, and sold badges. Shop-feel for artists selling directly.
 */
import Image from 'next/image';
import type { SiteData } from '../types';
import { SiteArtworkLink } from '../_components/site-artwork-runtime';
import { SiteCtaButton } from '../_components/site-cta-button';
import { SiteExhibitionList } from '../_components/site-exhibition-list';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { OrderedSections } from '../_components/ordered-sections';
import { EditableText } from '../_components/editable-text';
import { EditableImage } from '../_components/editable-image';
import { EditableCta } from '../_components/editable-cta';
import { resolveAccent, resolveSurface, mutedText, borderColor } from './palette';

export function ShopfrontTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color, site.theme.text_color);
  const bodyFont = 'var(--site-font-body, system-ui, sans-serif)';
  const headingFont = 'var(--site-font-heading, system-ui, sans-serif)';

  return (
    <div style={{ fontFamily: bodyFont, background: surface.bg, color: surface.ink }}>

      {/* ── STICKY NAV ── */}
      <nav className="sticky top-0 z-40 border-b" style={{ background: surface.bg, borderColor: borderColor(site.surface_color) }}>
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {site.picture_url && (
              <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                <Image src={site.picture_url} alt={site.name} fill className="object-cover" unoptimized />
              </div>
            )}
            {site.logo_image_url ? (
              <EditableImage field="logo">
                <Image src={site.logo_image_url} alt={site.display_name ?? site.name} width={0} height={0} sizes="100vw" className="h-7 w-auto object-contain" />
              </EditableImage>
            ) : (
              <EditableText field="display_name" value={site.display_name ?? site.name} placeholder="Your name" as="span" className="font-bold text-base" style={{ fontFamily: headingFont }} />
            )}
          </div>
          <div className="flex items-center gap-5 text-sm">
            {site.sections.artworks && site.artworks.length > 0 && <a href="#shop" style={{ color: accentColor }} className="font-medium hover:opacity-70 transition-opacity">Shop</a>}
            {site.sections.exhibitions && site.exhibitions.length > 0 && <a href="#exhibitions" style={{ color: mutedText(site.surface_color, site.theme.text_color) }} className="hover:opacity-70 transition-opacity">Shows</a>}
            {site.sections.press && site.press.length > 0 && <a href="#press" style={{ color: mutedText(site.surface_color, site.theme.text_color) }} className="hover:opacity-70 transition-opacity">Press</a>}
            {site.sections.contact && <a href="#contact" style={{ color: mutedText(site.surface_color, site.theme.text_color) }} className="hover:opacity-70 transition-opacity">Contact</a>}
            {site.cta && <EditableCta cta={site.cta}><SiteCtaButton cta={site.cta} /></EditableCta>}
          </div>
        </div>
      </nav>

      {/* ── WELCOME BLURB ── */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-12 pb-8">
        {site.hero_image_url && (
          <EditableImage field="hero">
            <div className="relative w-full rounded-2xl overflow-hidden mb-8" style={{ aspectRatio: '16/5' }}>
              <Image src={site.hero_image_url} alt={site.name} fill className="object-cover" unoptimized priority />
            </div>
          </EditableImage>
        )}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: headingFont }}>
              <EditableText field="tagline" value={site.tagline} placeholder={`Welcome to ${site.display_name ?? site.name}`} as="span" />
            </h1>
          </div>
          {site.location && <p className="text-sm flex-shrink-0" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{site.location}</p>}
        </div>
      </section>

      {/* ── ORDERED SECTIONS ── */}
      <OrderedSections
        order={site.section_order}
        sections={site.sections}
        accentColor={accentColor}
        slots={{
          bio: site.bio ? (
            <section className="max-w-6xl mx-auto px-4 md:px-8 pb-8">
              <EditableText field="bio" value={site.bio} placeholder="Write a short bio…" as="p" className="text-base leading-relaxed max-w-xl" style={{ color: mutedText(site.surface_color, site.theme.text_color) }} />
            </section>
          ) : undefined,

          artworks: site.artworks.length > 0 ? (
            <section id="shop" className="max-w-6xl mx-auto px-4 md:px-8 py-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ fontFamily: headingFont }}>All works</h2>
                <span className="text-sm" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{site.artworks.length} {site.artworks.length === 1 ? 'work' : 'works'}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {site.artworks.map((artwork) => (
                  <SiteArtworkLink key={artwork.id} artwork={artwork} className="group block rounded-xl border overflow-hidden transition-shadow hover:shadow-lg" style={{ borderColor: borderColor(site.surface_color) }}>
                    <div className="relative aspect-square overflow-hidden" style={{ background: `${surface.ink}06` }}>
                      {artwork.image_url ? (
                        <Image src={artwork.image_url} alt={artwork.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized loading="lazy" sizes="(max-width: 640px) 50vw, 25vw" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><span className="text-xs" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>No image</span></div>
                      )}
                      {artwork.sold_at && <span className="absolute top-2 right-2 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: surface.ink, color: surface.bg, fontFamily: bodyFont }}>Sold</span>}
                      {!artwork.sold_at && artwork.for_sale && <span className="absolute top-2 right-2 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: accentColor, color: surface.bg, fontFamily: bodyFont }}>For sale</span>}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold leading-snug mb-1 transition-colors group-hover:opacity-70" style={{ fontFamily: headingFont }}>{artwork.title}</h3>
                      {artwork.artist_name && <p className="text-xs mb-1" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{artwork.artist_name}</p>}
                      {artwork.sold_at ? (
                        <p className="text-xs" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>Sold</p>
                      ) : artwork.for_sale && artwork.sale_price ? (
                        <p className="text-sm font-bold" style={{ color: accentColor }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: (artwork.sale_currency ?? 'usd').toUpperCase(), minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(artwork.sale_price))}</p>
                      ) : (
                        <p className="text-xs" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{new Date(artwork.created_at).getFullYear()}</p>
                      )}
                    </div>
                  </SiteArtworkLink>
                ))}
              </div>
            </section>
          ) : undefined,

          exhibitions: site.exhibitions.length > 0 ? (
            <section id="exhibitions" className="border-t max-w-6xl mx-auto px-4 md:px-8 py-10" style={{ borderColor: borderColor(site.surface_color) }}>
              <h2 className="text-xl font-bold mb-6" style={{ fontFamily: headingFont }}>Shows</h2>
              <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
            </section>
          ) : undefined,

          press: site.press.length > 0 ? (
            <section id="press" className="border-t max-w-6xl mx-auto px-4 md:px-8 py-10" style={{ borderColor: borderColor(site.surface_color) }}>
              <h2 className="text-xl font-bold mb-6" style={{ fontFamily: headingFont }}>Press</h2>
              <SitePressList press={site.press} />
            </section>
          ) : undefined,

          contact: (
            <footer id="contact" className="border-t" style={{ borderColor: borderColor(site.surface_color), background: `${surface.ink}04` }}>
              <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: accentColor }}>Contact</p>
                    <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg" style={{ fontFamily: headingFont }}>{site.display_name ?? site.name}</p>
                    {site.medium && <p className="text-sm mt-1" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{site.medium}</p>}
                  </div>
                </div>
              </div>
            </footer>
          ),
        }}
      />
    </div>
  );
}
