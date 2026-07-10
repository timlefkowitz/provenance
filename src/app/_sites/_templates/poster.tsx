/**
 * Poster Template
 * Shrig Shop-inspired: playful, slightly tilted work tiles, large friendly
 * type, press rendered as a pinboard news section. For illustrators & printmakers.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SiteCtaButton } from '../_components/site-cta-button';
import { SiteContactBlock } from '../_components/site-contact-block';
import { resolveAccent, resolveSurface, mutedText } from './palette';

const TILE_ROTATIONS = ['-1.5deg', '1.2deg', '-0.8deg', '1.8deg', '-1.2deg', '0.9deg', '-1.6deg', '1.3deg'];

export function PosterTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color, site.theme.text_color);
  const headingFont = 'var(--site-font-heading, system-ui, sans-serif)';
  const bodyFont = 'var(--site-font-body, system-ui, sans-serif)';

  return (
    <div style={{ fontFamily: bodyFont, background: surface.bg, color: surface.ink, minHeight: '100svh' }}>

      {/* ── HEADER ── */}
      <header className="border-b-4 px-6 md:px-12 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4" style={{ borderColor: surface.ink }}>
        <div>
          {site.logo_image_url ? (
            <Image src={site.logo_image_url} alt={site.display_name ?? site.name} width={0} height={0} sizes="100vw" className="h-10 w-auto object-contain" />
          ) : (
            <h1
              className="text-3xl md:text-4xl font-black uppercase"
              style={{ fontFamily: headingFont, color: surface.ink, letterSpacing: '-0.02em' }}
            >
              {site.display_name ?? site.name}
            </h1>
          )}
          {(site.tagline || site.medium) && (
            <p className="text-sm mt-1" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>
              {site.tagline ?? site.medium}
            </p>
          )}
        </div>
        <nav className="flex flex-wrap gap-4 text-sm font-medium">
          {site.sections.artworks && site.artworks.length > 0 && (
            <a href="#works" className="underline underline-offset-4 hover:opacity-60 transition-opacity" style={{ color: accentColor }}>Works</a>
          )}
          {site.sections.exhibitions && site.exhibitions.length > 0 && (
            <a href="#exhibitions" className="underline underline-offset-4 hover:opacity-60 transition-opacity" style={{ color: surface.ink }}>Shows</a>
          )}
          {site.sections.press && site.press.length > 0 && (
            <a href="#news" className="underline underline-offset-4 hover:opacity-60 transition-opacity" style={{ color: surface.ink }}>News</a>
          )}
          {site.sections.contact && (
            <a href="#contact" className="underline underline-offset-4 hover:opacity-60 transition-opacity" style={{ color: surface.ink }}>Contact</a>
          )}
          {site.cta && <SiteCtaButton cta={site.cta} />}
        </nav>
      </header>

      {/* ── BIO ── */}
      {site.sections.bio && site.bio && (
        <section className="border-b-2 px-6 md:px-12 py-8" style={{ borderColor: `${surface.ink}20` }}>
          <p className="text-lg md:text-xl max-w-2xl leading-relaxed">{site.bio}</p>
        </section>
      )}

      {/* ── WORKS: tilted poster wall ── */}
      {site.sections.artworks && site.artworks.length > 0 && (
        <section id="works" className="px-6 md:px-12 py-12">
          <h2 className="text-[10px] uppercase tracking-[0.25em] mb-8" style={{ color: accentColor }}>Works</h2>
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {site.artworks.slice(0, 12).map((artwork, i) => (
              <Link
                key={artwork.id}
                href={`/works/${artwork.id}`}
                className="group block"
                style={{
                  transform: `rotate(${TILE_ROTATIONS[i % TILE_ROTATIONS.length]})`,
                  transition: 'transform 0.2s ease',
                  width: 'min(45vw, 220px)',
                }}
              >
                <div
                  className="border-4 overflow-hidden"
                  style={{ borderColor: surface.ink, background: `${surface.ink}08` }}
                >
                  <div className="relative" style={{ aspectRatio: '3/4' }}>
                    {artwork.image_url ? (
                      <Image
                        src={artwork.image_url}
                        alt={artwork.title}
                        fill
                        className="object-cover"
                        unoptimized
                        loading="lazy"
                        sizes="220px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-4">
                        <span className="text-center text-xs leading-relaxed" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{artwork.title}</span>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2 border-t-4" style={{ borderColor: surface.ink }}>
                    <p className="text-xs font-bold truncate">{artwork.title}</p>
                    {artwork.sold_at ? (
                      <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>Sold</p>
                    ) : artwork.for_sale && artwork.sale_price ? (
                      <p className="text-xs font-bold mt-0.5" style={{ color: accentColor }}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: (artwork.sale_currency ?? 'usd').toUpperCase(), minimumFractionDigits: 0 }).format(Number(artwork.sale_price))}
                      </p>
                    ) : (
                      <p className="text-[10px] mt-0.5" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{new Date(artwork.created_at).getFullYear()}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── EXHIBITIONS ── */}
      {site.sections.exhibitions && site.exhibitions.length > 0 && (
        <section id="exhibitions" className="border-t-4 px-6 md:px-12 py-12" style={{ borderColor: surface.ink }}>
          <h2 className="text-2xl md:text-3xl font-black uppercase mb-8" style={{ fontFamily: headingFont }}>Shows</h2>
          <div className="space-y-4">
            {site.exhibitions.map((ex) => (
              <Link key={ex.id} href={`/exhibitions/${ex.id}`} className="group block hover:opacity-60 transition-opacity">
                <h3 className="text-base font-bold" style={{ fontFamily: headingFont }}>{ex.title}</h3>
                <p className="text-sm" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>
                  {new Date(ex.start_date).getFullYear()}{ex.location ? ` · ${ex.location}` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── NEWS BOARD (press) ── */}
      {site.sections.press && site.press.length > 0 && (
        <section id="news" className="border-t-4 px-6 md:px-12 py-12" style={{ borderColor: surface.ink }}>
          <h2 className="text-2xl md:text-3xl font-black uppercase mb-8" style={{ fontFamily: headingFont }}>News</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {site.press.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block border-2 p-4 hover:opacity-70 transition-opacity"
                style={{ borderColor: `${surface.ink}30`, transform: `rotate(${TILE_ROTATIONS[i % 4]})`}}
              >
                {item.publication_name && (
                  <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: accentColor }}>{item.publication_name}</p>
                )}
                <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
                {item.date && <p className="text-[11px] mt-2" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{item.date}</p>}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── CONTACT ── */}
      {site.sections.contact && (
        <section id="contact" className="border-t-4 px-6 md:px-12 py-12" style={{ borderColor: surface.ink }}>
          <h2 className="text-2xl md:text-3xl font-black uppercase mb-8" style={{ fontFamily: headingFont }}>Contact</h2>
          <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
        </section>
      )}
    </div>
  );
}
