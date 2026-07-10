/**
 * Chronicle Template
 * James Jean-inspired: horizontal year tabs across the top, dense uniform
 * thumbnail grid per year. Monochrome, minimal, chronological.
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

function groupArtworksByYear(artworks: SiteArtwork[]): Map<number, SiteArtwork[]> {
  const map = new Map<number, SiteArtwork[]>();
  for (const a of artworks) {
    const year = new Date(a.created_at).getFullYear();
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(a);
  }
  return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
}

export function ChronicleTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color, site.theme.text_color);
  const headingFont = 'var(--site-font-heading, system-ui, sans-serif)';
  const bodyFont = 'var(--site-font-body, system-ui, sans-serif)';
  const yearGroups = groupArtworksByYear(site.artworks);
  const years = [...yearGroups.keys()];
  const [activeYear, setActiveYear] = useState<number>(years[0] ?? 0);

  const activeWorks = yearGroups.get(activeYear) ?? [];

  return (
    <div style={{ fontFamily: bodyFont, background: surface.bg, color: surface.ink }}>

      {/* ── HEADER ── */}
      <header className="border-b px-4 md:px-8 py-4 flex items-center justify-between gap-4" style={{ borderColor: borderColor(site.surface_color) }}>
        <div>
          {site.logo_image_url ? (
            <Image src={site.logo_image_url} alt={site.display_name ?? site.name} width={0} height={0} sizes="100vw" className="h-7 w-auto object-contain" />
          ) : (
            <h1 className="font-semibold text-sm" style={{ fontFamily: headingFont }}>{site.display_name ?? site.name}</h1>
          )}
        </div>
        <nav className="flex items-center gap-4 text-xs" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>
          {site.sections.exhibitions && site.exhibitions.length > 0 && <a href="#shows" className="hover:opacity-60">Shows</a>}
          {site.sections.press && site.press.length > 0 && <a href="#press" className="hover:opacity-60">Press</a>}
          {site.sections.contact && <a href="#contact" className="hover:opacity-60">Contact</a>}
          {site.cta && <SiteCtaButton cta={site.cta} />}
        </nav>
      </header>

      {/* ── NAME + BIO ── */}
      {site.sections.bio && site.bio && (
        <section className="border-b px-4 md:px-8 py-8" style={{ borderColor: borderColor(site.surface_color) }}>
          <p className="text-sm leading-relaxed max-w-2xl" style={{ color: surface.ink }}>{site.bio}</p>
        </section>
      )}

      {/* ── YEAR TABS ── */}
      {site.sections.artworks && years.length > 0 && (
        <div className="sticky top-0 z-10 border-b overflow-x-auto" style={{ borderColor: borderColor(site.surface_color), background: surface.bg }}>
          <div className="flex items-center min-w-max px-4 md:px-8">
            {years.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setActiveYear(year)}
                className="px-4 py-3 text-xs font-mono transition-colors whitespace-nowrap"
                style={{
                  color: activeYear === year ? accentColor : mutedText(site.surface_color, site.theme.text_color),
                  borderBottom: activeYear === year ? `2px solid ${accentColor}` : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── GRID FOR ACTIVE YEAR ── */}
      {site.sections.artworks && (
        <section className="px-4 md:px-8 py-6">
          {activeWorks.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1">
              {activeWorks.map((artwork) => (
                <Link key={artwork.id} href={`/works/${artwork.id}`} className="group block relative aspect-square overflow-hidden" style={{ background: `${surface.ink}06` }}>
                  {artwork.image_url ? (
                    <Image
                      src={artwork.image_url}
                      alt={artwork.title}
                      fill
                      className="object-cover transition-all duration-300 group-hover:scale-110 group-hover:opacity-80"
                      unoptimized
                      loading="lazy"
                      sizes="12vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-1">
                      <span className="text-[8px] text-center leading-tight" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>{artwork.title}</span>
                    </div>
                  )}
                  <div
                    className="absolute inset-0 flex items-end p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.6))' }}
                  >
                    <p className="text-white text-[9px] leading-tight">{artwork.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs py-10 text-center" style={{ color: mutedText(site.surface_color, site.theme.text_color) }}>No works for this year.</p>
          )}
        </section>
      )}

      {/* ── EXHIBITIONS ── */}
      {site.sections.exhibitions && site.exhibitions.length > 0 && (
        <section id="shows" className="border-t px-4 md:px-8 py-10" style={{ borderColor: borderColor(site.surface_color) }}>
          <h2 className="text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: accentColor }}>Shows</h2>
          <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
        </section>
      )}

      {/* ── PRESS ── */}
      {site.sections.press && site.press.length > 0 && (
        <section id="press" className="border-t px-4 md:px-8 py-10" style={{ borderColor: borderColor(site.surface_color) }}>
          <h2 className="text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: accentColor }}>Press</h2>
          <SitePressList press={site.press} />
        </section>
      )}

      {/* ── CONTACT ── */}
      {site.sections.contact && (
        <section id="contact" className="border-t px-4 md:px-8 py-10" style={{ borderColor: borderColor(site.surface_color) }}>
          <h2 className="text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: accentColor }}>Contact</h2>
          <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
        </section>
      )}
    </div>
  );
}
