/**
 * Ledger Template
 * James Jean-inspired: ultra-minimal text index of works with inline
 * hover/tap thumbnail reveal. For archives and estates.
 */
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { SiteData, SiteArtwork } from '../types';
import { SiteCtaButton } from '../_components/site-cta-button';
import { SiteExhibitionList } from '../_components/site-exhibition-list';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { resolveAccent, resolveSurface, mutedText, borderColor } from './palette';

function sortByYear(artworks: SiteArtwork[]): SiteArtwork[] {
  return [...artworks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function LedgerTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color, site.theme.text_color);
  const headingFont = 'var(--site-font-heading, system-ui, sans-serif)';
  const bodyFont = 'var(--site-font-body, system-ui, sans-serif)';
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const sorted = sortByYear(site.artworks);
  const hoveredArtwork = sorted.find((a) => a.id === hoveredId);

  return (
    <div style={{ fontFamily: bodyFont, background: surface.bg, color: surface.ink, minHeight: '100svh' }}>

      {/* ── HEADER ── */}
      <header
        className="flex items-center justify-between gap-4 px-6 md:px-12 py-5 border-b"
        style={{ borderColor: borderColor(site.surface_color) }}
      >
        <div>
          {site.logo_image_url ? (
            <Image src={site.logo_image_url} alt={site.display_name ?? site.name} width={0} height={0} sizes="100vw" className="h-6 w-auto object-contain" />
          ) : (
            <h1 className="text-sm font-semibold tracking-tight" style={{ fontFamily: headingFont }}>{site.display_name ?? site.name}</h1>
          )}
          {site.medium && <p className="text-[11px] mt-0.5" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{site.medium}</p>}
        </div>
        <nav className="flex items-center gap-5 text-xs" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>
          {site.sections.exhibitions && site.exhibitions.length > 0 && <a href="#shows" className="hover:opacity-60">Shows</a>}
          {site.sections.press && site.press.length > 0 && <a href="#press" className="hover:opacity-60">Press</a>}
          {site.sections.contact && <a href="#contact" className="hover:opacity-60">Contact</a>}
          {site.cta && <SiteCtaButton cta={site.cta} />}
        </nav>
      </header>

      <div className="flex">
        {/* ── LEDGER LIST ── */}
        <main className="flex-1 min-w-0">

          {/* Bio */}
          {site.sections.bio && site.bio && (
            <section className="border-b px-6 md:px-12 py-8 max-w-xl" style={{ borderColor: borderColor(site.surface_color) }}>
              <p className="text-sm leading-relaxed">{site.bio}</p>
            </section>
          )}

          {/* Works ledger */}
          {site.sections.artworks && sorted.length > 0 && (
            <section className="border-b" style={{ borderColor: borderColor(site.surface_color) }}>
              <div className="px-6 md:px-12 py-5 flex items-center gap-6 text-[10px] uppercase tracking-widest" style={{ color: mutedText(site.surface_color, site.theme.text_color), borderBottom: `1px solid ${borderColor(site.surface_color)}` }}>
                <span className="w-12 flex-shrink-0">Year</span>
                <span className="flex-1">Title</span>
                <span className="hidden md:block w-40 text-right">Artist</span>
              </div>
              <ul>
                {sorted.map((artwork) => {
                  const year = new Date(artwork.created_at).getFullYear();
                  return (
                    <li
                      key={artwork.id}
                      onMouseEnter={() => setHoveredId(artwork.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <Link
                        href={`/works/${artwork.id}`}
                        className="flex items-center gap-6 px-6 md:px-12 py-3 transition-all hover:pl-8 md:hover:pl-14 border-b"
                        style={{
                          borderColor: borderColor(site.surface_color),
                          background: hoveredId === artwork.id ? `${accentColor}08` : 'transparent',
                        }}
                      >
                        <span className="w-12 flex-shrink-0 text-xs font-mono" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{year}</span>
                        <span className="flex-1 text-sm" style={{ color: surface.ink }}>{artwork.title}</span>
                        {artwork.artist_name && (
                          <span className="hidden md:block w-40 text-right text-xs" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{artwork.artist_name}</span>
                        )}
                        {artwork.sold_at ? (
                          <span className="text-[10px] uppercase tracking-widest flex-shrink-0" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>Sold</span>
                        ) : artwork.for_sale && artwork.sale_price ? (
                          <span className="text-xs flex-shrink-0" style={{ color: accentColor }}>
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: (artwork.sale_currency ?? 'usd').toUpperCase(), minimumFractionDigits: 0 }).format(Number(artwork.sale_price))}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Exhibitions */}
          {site.sections.exhibitions && site.exhibitions.length > 0 && (
            <section id="shows" className="border-b px-6 md:px-12 py-10" style={{ borderColor: borderColor(site.surface_color) }}>
              <h2 className="text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: accentColor }}>Shows</h2>
              <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
            </section>
          )}

          {/* Press */}
          {site.sections.press && site.press.length > 0 && (
            <section id="press" className="border-b px-6 md:px-12 py-10" style={{ borderColor: borderColor(site.surface_color) }}>
              <h2 className="text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: accentColor }}>Press</h2>
              <SitePressList press={site.press} />
            </section>
          )}

          {/* Contact */}
          {site.sections.contact && (
            <section id="contact" className="px-6 md:px-12 py-10">
              <h2 className="text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: accentColor }}>Contact</h2>
              <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
            </section>
          )}
        </main>

        {/* ── FLOATING THUMBNAIL ── */}
        {hoveredArtwork?.image_url && (
          <div
            className="hidden md:block fixed pointer-events-none"
            style={{ right: '2rem', top: '50%', transform: 'translateY(-50%)', width: '280px', zIndex: 50 }}
          >
            <div className="relative aspect-square rounded overflow-hidden shadow-2xl">
              <Image
                src={hoveredArtwork.image_url}
                alt={hoveredArtwork.title}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <p className="text-xs mt-2 text-center" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{hoveredArtwork.title}</p>
          </div>
        )}
      </div>
    </div>
  );
}
