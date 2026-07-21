/**
 * Studio Template
 * Minimalist portfolio grid. Dense artwork-first layout, clean sans-serif.
 * Best fit for artists showing a volume of work.
 */
import Image from 'next/image';
import type { SiteData } from '../types';
import { SiteArtworkCard } from '../_components/site-artwork-card';
import { SiteExhibitionList } from '../_components/site-exhibition-list';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';
import { OrderedSections } from '../_components/ordered-sections';
import { EditableText } from '../_components/editable-text';
import { EditableImage } from '../_components/editable-image';
import { EditableCta } from '../_components/editable-cta';
import { resolveAccent, resolveSurface, borderColor, mutedText } from './palette';

export function StudioTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color);
  return (
    <div style={{ fontFamily: 'var(--site-font-body, system-ui, -apple-system, sans-serif)', color: surface.ink, background: surface.bg }}>

      {/* ── HERO BANNER (optional) ── */}
      {site.hero_image_url && (
        <EditableImage field="hero">
          <div className="relative w-full h-48 md:h-72 overflow-hidden border-b" style={{ borderColor: borderColor(site.surface_color) }}>
            <Image
              src={site.hero_image_url}
              alt={site.name}
              fill
              className="object-cover"
              unoptimized
              priority
            />
          </div>
        </EditableImage>
      )}

      {/* ── HEADER ── */}
      <header className="border-b" style={{ borderColor: borderColor(site.surface_color) }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            {site.picture_url && (
              <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={site.picture_url}
                  alt={site.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <div>
              {site.logo_image_url ? (
                <EditableImage field="logo">
                  <Image
                    src={site.logo_image_url}
                    alt={site.display_name ?? site.name}
                    width={0}
                    height={0}
                    sizes="100vw"
                    className="h-7 w-auto object-contain"
                  />
                </EditableImage>
              ) : (
                <h1 className="text-base font-semibold tracking-tight" style={{ color: surface.ink }}>
                  <EditableText
                    field="display_name"
                    value={site.display_name ?? site.name}
                    placeholder="Your name"
                    as="span"
                  />
                </h1>
              )}
              <EditableText
                field="tagline"
                value={site.tagline ?? null}
                placeholder={`${site.medium ?? site.role}`}
                as="p"
                className="text-xs mt-0.5"
                style={{ color: mutedText(site.surface_color) }}
              />
            </div>
          </div>

          <nav className="flex items-center gap-5">
            {site.sections.artworks && site.artworks.length > 0 && (
              <a href="#works" className="text-xs hover:opacity-60 transition-opacity" style={{ color: '#555' }}>
                Works
              </a>
            )}
            {site.sections.exhibitions && site.exhibitions.length > 0 && (
              <a href="#exhibitions" className="text-xs hover:opacity-60 transition-opacity" style={{ color: '#555' }}>
                Exhibitions
              </a>
            )}
            {site.sections.press && site.press.length > 0 && (
              <a href="#press" className="text-xs hover:opacity-60 transition-opacity" style={{ color: '#555' }}>
                Press
              </a>
            )}
            {site.sections.contact && (
              <a href="#contact" className="text-xs hover:opacity-60 transition-opacity" style={{ color: '#555' }}>
                Contact
              </a>
            )}
            {site.cta && (
              <EditableCta cta={site.cta}>
                <SiteCtaButton cta={site.cta} />
              </EditableCta>
            )}
          </nav>
        </div>
      </header>

      {/* ── ORDERED SECTIONS ── */}
      <OrderedSections
        order={site.section_order}
        sections={site.sections}
        accentColor={accentColor}
        slots={{
          bio: site.bio ? (
            <section className="max-w-6xl mx-auto px-6 py-10 border-b" style={{ borderColor: '#e4e4e4' }}>
              <EditableText
                field="bio"
                value={site.bio}
                placeholder="Write a short bio…"
                as="p"
                className="text-sm leading-relaxed max-w-2xl"
                style={{ color: '#444' }}
              />
            </section>
          ) : undefined,

          artworks: site.artworks.length > 0 ? (
            <section id="works" className="max-w-6xl mx-auto px-6 py-10">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs uppercase tracking-[0.15em]" style={{ color: accentColor }}>
                  Works
                </span>
                <span className="text-xs" style={{ color: '#ccc' }}>
                  {site.artworks.length}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {site.artworks.map((artwork) => (
                  <SiteArtworkCard
                    key={artwork.id}
                    artwork={artwork}
                    handle={site.handle}
                    accentColor={accentColor}
                  />
                ))}
              </div>
            </section>
          ) : undefined,

          exhibitions: site.exhibitions.length > 0 ? (
            <section id="exhibitions" className="border-t" style={{ borderColor: '#e4e4e4' }}>
              <div className="max-w-6xl mx-auto px-6 py-10">
                <span className="block text-xs uppercase tracking-[0.15em] mb-6" style={{ color: accentColor }}>
                  Exhibitions
                </span>
                <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
              </div>
            </section>
          ) : undefined,

          press: site.press.length > 0 ? (
            <section id="press" className="border-t" style={{ borderColor: '#e4e4e4' }}>
              <div className="max-w-6xl mx-auto px-6 py-10">
                <span className="block text-xs uppercase tracking-[0.15em] mb-6" style={{ color: accentColor }}>
                  Press
                </span>
                <div className="max-w-xl">
                  <SitePressList press={site.press} />
                </div>
              </div>
            </section>
          ) : undefined,

          contact: (
            <section id="contact" className="border-t" style={{ borderColor: '#e4e4e4' }}>
              <div className="max-w-6xl mx-auto px-6 py-10">
                <span className="block text-xs uppercase tracking-[0.15em] mb-6" style={{ color: accentColor }}>
                  Contact
                </span>
                <SiteContactBlock
                  name={site.name}
                  website={site.website}
                  location={site.location}
                  medium={site.medium}
                />
              </div>
            </section>
          ),
        }}
      />
    </div>
  );
}
