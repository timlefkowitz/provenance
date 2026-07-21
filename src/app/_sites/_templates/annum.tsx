/**
 * Annum Template
 * James Jean-inspired: fixed left sidebar listing years, minimal canvas,
 * anchor-jump to each year's work group. For deep archives.
 */
import Image from 'next/image';
import type { SiteData, SiteArtwork } from '../types';
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

function groupArtworksByYear(artworks: SiteArtwork[]): Map<number, SiteArtwork[]> {
  const map = new Map<number, SiteArtwork[]>();
  for (const a of artworks) {
    const yr = new Date(a.created_at).getFullYear();
    if (!map.has(yr)) map.set(yr, []);
    map.get(yr)!.push(a);
  }
  return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
}

export function AnnumTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color, site.theme.text_color);
  const headingFont = 'var(--site-font-heading, system-ui, sans-serif)';
  const bodyFont = 'var(--site-font-body, system-ui, sans-serif)';
  const yearGroups = groupArtworksByYear(site.artworks);
  const years = [...yearGroups.keys()];

  return (
    <div style={{ fontFamily: bodyFont, background: surface.bg, color: surface.ink, minHeight: '100svh' }}>

      {/* ── HEADER ── */}
      <header className="border-b px-6 md:px-8 py-5 flex items-center justify-between gap-4" style={{ borderColor: borderColor(site.surface_color) }}>
        <div className="flex items-center gap-3">
          {site.picture_url && (
            <div className="relative w-7 h-7 rounded-full overflow-hidden">
              <Image src={site.picture_url} alt={site.name} fill className="object-cover" unoptimized />
            </div>
          )}
          {site.logo_image_url ? (
            <EditableImage field="logo">
              <Image src={site.logo_image_url} alt={site.display_name ?? site.name} width={0} height={0} sizes="100vw" className="h-6 w-auto object-contain" />
            </EditableImage>
          ) : (
            <h1 className="text-sm font-semibold" style={{ fontFamily: headingFont }}>
              <EditableText field="display_name" value={site.display_name ?? site.name} placeholder="Your name" as="span" />
            </h1>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>
          {site.medium && <span>{site.medium}</span>}
          {site.sections.contact && <a href="#contact" className="hover:opacity-60">Contact</a>}
          {site.cta && <EditableCta cta={site.cta}><SiteCtaButton cta={site.cta} /></EditableCta>}
        </div>
      </header>

      <div className="flex">
        {/* ── SIDEBAR ── */}
        <aside className="hidden md:flex flex-col gap-0.5 border-r sticky top-0 h-screen overflow-y-auto" style={{ borderColor: borderColor(site.surface_color), width: '120px', flexShrink: 0, paddingTop: '2.5rem', paddingLeft: '1.5rem', paddingRight: '1rem' }}>
          {site.sections.bio && site.bio && (
            <a href="#bio" className="block text-xs py-1 hover:opacity-60 transition-opacity mb-4" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>Info</a>
          )}
          {years.map((yr) => (
            <a key={yr} href={`#year-${yr}`} className="block py-1 text-sm hover:opacity-60 transition-opacity" style={{ fontFamily: headingFont, color: surface.ink }}>{yr}</a>
          ))}
          {site.sections.exhibitions && site.exhibitions.length > 0 && (
            <a href="#exhibitions" className="block py-1 text-xs mt-4 hover:opacity-60 transition-opacity" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>Shows</a>
          )}
          {site.sections.press && site.press.length > 0 && (
            <a href="#press" className="block py-1 text-xs hover:opacity-60 transition-opacity" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>Press</a>
          )}
        </aside>

        {/* ── MAIN ── */}
        <main className="flex-1 min-w-0">

          {/* Bio */}
          {site.sections.bio && site.bio && (
            <section id="bio" className="border-b px-6 md:px-10 py-10" style={{ borderColor: borderColor(site.surface_color) }}>
              {site.hero_image_url && (
                <EditableImage field="hero">
                  <div className="relative w-full mb-6 overflow-hidden rounded" style={{ maxHeight: '320px' }}>
                    <Image src={site.hero_image_url} alt={site.name} width={1200} height={400} className="w-full object-cover" unoptimized />
                  </div>
                </EditableImage>
              )}
              <EditableText field="bio" value={site.bio} placeholder="Write a short bio…" as="p" className="text-sm md:text-base leading-relaxed max-w-xl" style={{ color: surface.ink }} />
              <EditableText field="tagline" value={site.tagline} placeholder="Your tagline…" as="p" className="text-xs mt-4" style={{ color: mutedText(site.surface_color, site.theme.text_color) }} />
            </section>
          )}

          {/* Works by year */}
          {site.sections.artworks && [...yearGroups.entries()].map(([yr, works]) => (
            <section key={yr} id={`year-${yr}`} className="border-b px-6 md:px-10 py-10" style={{ borderColor: borderColor(site.surface_color) }}>
              <h2 className="text-5xl md:text-7xl font-black mb-8 select-none" style={{ fontFamily: headingFont, color: `${surface.ink}12` }}>{yr}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {works.map((artwork) => (
                  <SiteArtworkLink key={artwork.id} artwork={artwork} className="group block">
                    <div className="relative aspect-square overflow-hidden" style={{ background: `${surface.ink}06` }}>
                      {artwork.image_url ? (
                        <Image src={artwork.image_url} alt={artwork.title} fill className="object-cover transition-opacity duration-300 group-hover:opacity-80" unoptimized loading="lazy" sizes="25vw" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><span className="text-[10px] text-center px-2" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{artwork.title}</span></div>
                      )}
                    </div>
                    <p className="text-xs mt-1.5 leading-snug truncate" style={{ color: surface.ink }}>{artwork.title}</p>
                  </SiteArtworkLink>
                ))}
              </div>
            </section>
          ))}

          {/* Exhibitions, Press, Contact via OrderedSections */}
          <OrderedSections
            order={site.section_order}
            sections={site.sections}
            accentColor={accentColor}
            slots={{
              bio: undefined,
              artworks: undefined,
              exhibitions: site.exhibitions.length > 0 ? (
                <section id="exhibitions" className="border-b px-6 md:px-10 py-10" style={{ borderColor: borderColor(site.surface_color) }}>
                  <h2 className="text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: accentColor }}>Shows</h2>
                  <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
                </section>
              ) : undefined,
              press: site.press.length > 0 ? (
                <section id="press" className="border-b px-6 md:px-10 py-10" style={{ borderColor: borderColor(site.surface_color) }}>
                  <h2 className="text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: accentColor }}>Press</h2>
                  <SitePressList press={site.press} />
                </section>
              ) : undefined,
              contact: (
                <section id="contact" className="px-6 md:px-10 py-10">
                  <h2 className="text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: accentColor }}>Contact</h2>
                  <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
                </section>
              ),
            }}
          />
        </main>
      </div>
    </div>
  );
}
