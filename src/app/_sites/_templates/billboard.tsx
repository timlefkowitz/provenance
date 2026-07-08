/**
 * Billboard Template
 * Contino-inspired: stacked full-bleed color-block sections, huge uppercase
 * headlines, two-column work grid, "The Latest" press newsreel.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SiteCtaButton } from '../_components/site-cta-button';
import { SiteContactBlock } from '../_components/site-contact-block';
import { resolveAccent, resolveSurface, mutedText } from './palette';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

export function BillboardTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color, site.theme.text_color);
  const headingFont = 'var(--site-font-heading, system-ui, sans-serif)';

  return (
    <div style={{ fontFamily: 'var(--site-font-body, system-ui, sans-serif)', background: surface.bg, color: surface.ink }}>

      {/* ── HERO BLOCK ── */}
      <section
        style={{ background: accentColor, color: surface.bg }}
        className="px-6 md:px-16 pt-10 pb-16"
      >
        <header className="flex items-center justify-between mb-16">
          {site.logo_image_url ? (
            <img src={site.logo_image_url} alt={site.display_name ?? site.name} className="h-7 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          ) : (
            <span className="text-sm uppercase tracking-[0.2em] opacity-80" style={{ fontFamily: headingFont }}>{site.display_name ?? site.name}</span>
          )}
          <nav className="flex gap-5 text-xs uppercase tracking-widest opacity-70">
            {site.sections.artworks && site.artworks.length > 0 && <a href="#works" style={{ color: 'inherit' }}>Work</a>}
            {site.sections.exhibitions && site.exhibitions.length > 0 && <a href="#shows" style={{ color: 'inherit' }}>Shows</a>}
            {site.sections.press && site.press.length > 0 && <a href="#press" style={{ color: 'inherit' }}>Press</a>}
            {site.sections.contact && <a href="#contact" style={{ color: 'inherit' }}>Contact</a>}
          </nav>
        </header>

        <h1
          className="text-6xl md:text-8xl lg:text-[10rem] font-black uppercase leading-none tracking-tighter"
          style={{ fontFamily: headingFont, color: surface.bg }}
        >
          {site.display_name ?? site.name}
        </h1>
        {site.tagline && (
          <p className="mt-6 text-base md:text-xl max-w-xl opacity-80" style={{ color: surface.bg }}>{site.tagline}</p>
        )}
        {site.cta && (
          <div className="mt-8">
            <SiteCtaButton cta={site.cta} />
          </div>
        )}
      </section>

      {/* ── BIO STRIPE ── */}
      {site.sections.bio && site.bio && (
        <section className="px-6 md:px-16 py-12 border-b" style={{ borderColor: `${surface.ink}14` }}>
          <p className="text-base md:text-xl max-w-2xl leading-relaxed">{site.bio}</p>
        </section>
      )}

      {/* ── WORKS GRID ── */}
      {site.sections.artworks && site.artworks.length > 0 && (
        <section id="works" className="px-6 md:px-16 py-14">
          <h2
            className="text-4xl md:text-6xl font-black uppercase leading-none tracking-tighter mb-10"
            style={{ fontFamily: headingFont, color: accentColor }}
          >
            Work
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-0.5">
            {site.artworks.slice(0, 12).map((artwork) => (
              <Link key={artwork.id} href={`/works/${artwork.id}`} className="group block relative overflow-hidden bg-gray-50" style={{ aspectRatio: '4/3' }}>
                {artwork.image_url ? (
                  <Image
                    src={artwork.image_url}
                    alt={artwork.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized
                    loading="lazy"
                    sizes="(max-width: 640px) 50vw, 50vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: `${surface.ink}08` }}>
                    <span className="text-xs" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>No image</span>
                  </div>
                )}
                <div
                  className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.75))' }}
                >
                  <p className="text-white text-sm font-semibold leading-snug">{artwork.title}</p>
                  {artwork.sold_at ? (
                    <span className="text-[10px] uppercase tracking-widest text-white/70 mt-1">Sold</span>
                  ) : artwork.for_sale && artwork.sale_price ? (
                    <span className="text-white/80 text-xs mt-1">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: (artwork.sale_currency ?? 'usd').toUpperCase(), minimumFractionDigits: 0 }).format(Number(artwork.sale_price))}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── EXHIBITIONS ── */}
      {site.sections.exhibitions && site.exhibitions.length > 0 && (
        <section id="shows" className="px-6 md:px-16 py-14 border-t" style={{ borderColor: `${surface.ink}14`, background: `${accentColor}08` }}>
          <h2
            className="text-4xl md:text-6xl font-black uppercase leading-none tracking-tighter mb-10"
            style={{ fontFamily: headingFont, color: accentColor }}
          >
            Shows
          </h2>
          <div className="space-y-0">
            {site.exhibitions.map((ex, i) => (
              <Link
                key={ex.id}
                href={`/exhibitions/${ex.id}`}
                className="group flex items-baseline justify-between gap-6 py-5 border-b hover:opacity-70 transition-opacity"
                style={{ borderColor: `${surface.ink}14` }}
              >
                <span className="text-[11px] text-left opacity-40 w-6 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex-1 text-base font-semibold" style={{ fontFamily: headingFont }}>{ex.title}</span>
                <span className="text-xs text-right" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>
                  {formatDate(ex.start_date)}{ex.location ? ` · ${ex.location}` : ''}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── THE LATEST (press) ── */}
      {site.sections.press && site.press.length > 0 && (
        <section id="press" className="px-6 md:px-16 py-14 border-t" style={{ borderColor: `${surface.ink}14` }}>
          <h2
            className="text-4xl md:text-6xl font-black uppercase leading-none tracking-tighter mb-10"
            style={{ fontFamily: headingFont, color: accentColor }}
          >
            The Latest
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {site.press.slice(0, 6).map((item, i) => (
              <a key={i} href={item.url} target="_blank" rel="noreferrer" className="group block border-t pt-4 hover:opacity-70 transition-opacity" style={{ borderColor: accentColor }}>
                {item.publication_name && (
                  <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: accentColor }}>{item.publication_name}</p>
                )}
                <h3 className="text-sm font-semibold leading-snug mb-2" style={{ fontFamily: headingFont }}>{item.title}</h3>
                {item.date && <p className="text-[11px]" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{item.date}</p>}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── CONTACT ── */}
      {site.sections.contact && (
        <section id="contact" className="border-t px-6 md:px-16 py-14" style={{ borderColor: `${surface.ink}14` }}>
          <h2
            className="text-4xl md:text-6xl font-black uppercase leading-none tracking-tighter mb-10"
            style={{ fontFamily: headingFont, color: accentColor }}
          >
            Contact
          </h2>
          <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
        </section>
      )}
    </div>
  );
}
