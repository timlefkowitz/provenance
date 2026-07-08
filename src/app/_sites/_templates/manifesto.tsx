/**
 * Manifesto Template
 * Contino-inspired: emotion-led, oversized typographic hero, alternating
 * full-width case-study rows. Bold statement identity for studios & artists.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SiteCtaButton } from '../_components/site-cta-button';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SitePressList } from '../_components/site-press-list';
import { resolveAccent, resolveSurface, mutedText } from './palette';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

export function ManifestoTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color, site.theme.text_color);

  return (
    <div
      style={{
        fontFamily: 'var(--site-font-body, system-ui, sans-serif)',
        background: surface.bg,
        color: surface.ink,
        minHeight: '100svh',
      }}
    >
      {/* ── HERO ── */}
      <section
        style={{ borderBottom: `1px solid ${accentColor}22` }}
        className="min-h-[80svh] flex flex-col justify-between px-6 md:px-16 py-10 md:py-20"
      >
        <header className="flex items-start justify-between gap-6">
          <div>
            {site.logo_image_url ? (
              <img src={site.logo_image_url} alt={site.display_name ?? site.name} className="h-8 w-auto object-contain" />
            ) : (
              <span
                className="text-xs uppercase tracking-[0.25em]"
                style={{ color: mutedText(site.surface_color, site.theme.text_color), fontFamily: 'var(--site-font-heading, system-ui, sans-serif)' }}
              >
                {site.display_name ?? site.name}
              </span>
            )}
          </div>
          <nav className="flex gap-6 text-xs uppercase tracking-widest" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>
            {site.sections.artworks && site.artworks.length > 0 && <a href="#works">Work</a>}
            {site.sections.exhibitions && site.exhibitions.length > 0 && <a href="#exhibitions">Shows</a>}
            {site.sections.press && site.press.length > 0 && <a href="#press">Press</a>}
            {site.sections.contact && <a href="#contact">Contact</a>}
            {site.cta && <SiteCtaButton cta={site.cta} />}
          </nav>
        </header>

        <div className="mt-auto pt-20">
          {site.tagline ? (
            <p
              className="text-5xl md:text-7xl lg:text-8xl font-bold leading-none tracking-tight mb-8 max-w-5xl"
              style={{ fontFamily: 'var(--site-font-heading, system-ui, sans-serif)', color: accentColor }}
            >
              {site.tagline}
            </p>
          ) : site.bio ? (
            <p
              className="text-4xl md:text-6xl font-bold leading-tight tracking-tight mb-8 max-w-4xl"
              style={{ fontFamily: 'var(--site-font-heading, system-ui, sans-serif)', color: accentColor }}
            >
              {site.bio.slice(0, 120)}
            </p>
          ) : (
            <p
              className="text-6xl md:text-8xl font-bold leading-none tracking-tight mb-8"
              style={{ fontFamily: 'var(--site-font-heading, system-ui, sans-serif)', color: accentColor }}
            >
              {site.display_name ?? site.name}
            </p>
          )}

          {site.sections.bio && site.bio && site.tagline && (
            <p className="text-base md:text-lg max-w-2xl leading-relaxed" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>
              {site.bio}
            </p>
          )}
        </div>
      </section>

      {/* ── WORKS as case-study rows ── */}
      {site.sections.artworks && site.artworks.length > 0 && (
        <section id="works" className="py-4">
          <div className="px-6 md:px-16 py-10">
            <span className="text-[10px] uppercase tracking-[0.25em]" style={{ color: accentColor }}>Work</span>
          </div>
          {site.artworks.slice(0, 12).map((artwork, i) => (
            <Link
              key={artwork.id}
              href={`/works/${artwork.id}`}
              className="group flex flex-col md:flex-row border-t"
              style={{ borderColor: `${surface.ink}14`, flexDirection: i % 2 === 0 ? 'row' : 'row-reverse' }}
            >
              <div className="md:w-1/2 relative aspect-video overflow-hidden" style={{ background: `${surface.ink}08` }}>
                {artwork.image_url ? (
                  <Image
                    src={artwork.image_url}
                    alt={artwork.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    unoptimized
                    loading="lazy"
                    sizes="50vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xs" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>No image</span>
                  </div>
                )}
              </div>
              <div className="md:w-1/2 flex flex-col justify-center px-6 md:px-16 py-10 md:py-16 gap-4">
                <h3
                  className="text-2xl md:text-3xl font-bold leading-tight transition-opacity group-hover:opacity-70"
                  style={{ fontFamily: 'var(--site-font-heading, system-ui, sans-serif)', color: surface.ink }}
                >
                  {artwork.title}
                </h3>
                {artwork.artist_name && (
                  <p className="text-sm" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{artwork.artist_name}</p>
                )}
                <p className="text-xs uppercase tracking-widest" style={{ color: accentColor }}>
                  {new Date(artwork.created_at).getFullYear()}
                  {artwork.sold_at ? ' · Sold' : artwork.for_sale && artwork.sale_price ? ` · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: (artwork.sale_currency ?? 'usd').toUpperCase(), minimumFractionDigits: 0 }).format(Number(artwork.sale_price))}` : ''}
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* ── EXHIBITIONS ── */}
      {site.sections.exhibitions && site.exhibitions.length > 0 && (
        <section id="exhibitions" className="border-t px-6 md:px-16 py-16" style={{ borderColor: `${surface.ink}14` }}>
          <span className="block text-[10px] uppercase tracking-[0.25em] mb-10" style={{ color: accentColor }}>Shows</span>
          <div className="grid md:grid-cols-2 gap-6">
            {site.exhibitions.map((ex) => (
              <Link key={ex.id} href={`/exhibitions/${ex.id}`} className="group block border-t pt-5 hover:opacity-70 transition-opacity" style={{ borderColor: `${surface.ink}20` }}>
                <h3 className="text-lg font-semibold leading-snug mb-2" style={{ color: surface.ink, fontFamily: 'var(--site-font-heading, system-ui, sans-serif)' }}>{ex.title}</h3>
                <p className="text-xs" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>
                  {formatDate(ex.start_date)}{ex.end_date ? ` – ${formatDate(ex.end_date)}` : ''}
                  {ex.location ? ` · ${ex.location}` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── PRESS ── */}
      {site.sections.press && site.press.length > 0 && (
        <section id="press" className="border-t px-6 md:px-16 py-16" style={{ borderColor: `${surface.ink}14` }}>
          <span className="block text-[10px] uppercase tracking-[0.25em] mb-10" style={{ color: accentColor }}>Press</span>
          <div className="max-w-xl">
            <SitePressList press={site.press} />
          </div>
        </section>
      )}

      {/* ── CONTACT ── */}
      {site.sections.contact && (
        <section id="contact" className="border-t px-6 md:px-16 py-16" style={{ borderColor: `${surface.ink}14` }}>
          <span className="block text-[10px] uppercase tracking-[0.25em] mb-10" style={{ color: accentColor }}>Contact</span>
          <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
        </section>
      )}
    </div>
  );
}
