/**
 * Editorial Template
 * Magazine-style layout. Exhibitions-forward with a large hero image,
 * serif-led typography, prominent press section.
 * Best fit for galleries and institutions.
 */
import Image from 'next/image';
import type { SiteData } from '../types';
import { SiteArtworkCard } from '../_components/site-artwork-card';
import { SiteExhibitionList } from '../_components/site-exhibition-list';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';

export function EditorialTemplate({ site }: { site: SiteData }) {
  // Prefer the dedicated hero image; fall back to most recent artwork, then profile picture
  const heroBg = site.hero_image_url ?? site.artworks[0]?.image_url ?? site.picture_url ?? null;
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color);

  return (
    <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: surface.ink, background: surface.bg }}>

      {/* ── NAV ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: '#fff', borderColor: '#e8e8e8' }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center" style={{ color: accentColor }}>
            {site.logo_image_url ? (
              <img
                src={site.logo_image_url}
                alt={site.display_name ?? site.name}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <span className="text-lg font-bold tracking-tight">{site.display_name ?? site.name}</span>
            )}
          </a>
          <nav className="flex items-center gap-6">
            {site.sections.artworks && site.artworks.length > 0 && (
              <a href="#works" className="text-xs uppercase tracking-widest hover:opacity-60 transition-opacity" style={{ color: '#555' }}>
                Works
              </a>
            )}
            {site.sections.exhibitions && site.exhibitions.length > 0 && (
              <a href="#exhibitions" className="text-xs uppercase tracking-widest hover:opacity-60 transition-opacity" style={{ color: '#555' }}>
                Exhibitions
              </a>
            )}
            {site.sections.press && site.press.length > 0 && (
              <a href="#press" className="text-xs uppercase tracking-widest hover:opacity-60 transition-opacity" style={{ color: '#555' }}>
                Press
              </a>
            )}
            {site.sections.contact && (
              <a href="#contact" className="text-xs uppercase tracking-widest hover:opacity-60 transition-opacity" style={{ color: '#555' }}>
                Contact
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative" style={{ minHeight: '60vh', background: '#f9f6f1' }}>
        {heroBg && (
          <div className="absolute inset-0">
            <Image
              src={heroBg}
              alt={site.name}
              fill
              className="object-cover"
              unoptimized
              priority
            />
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />
          </div>
        )}
        <div
          className="relative z-10 max-w-5xl mx-auto px-6 flex flex-col justify-end"
          style={{ minHeight: '60vh', paddingBottom: '3rem' }}
        >
          <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: heroBg ? 'rgba(255,255,255,0.7)' : '#999' }}>
            {site.medium || site.role}
          </p>
          {site.logo_image_url ? (
            <img
              src={site.logo_image_url}
              alt={site.display_name ?? site.name}
              className="max-h-32 md:max-h-48 w-auto object-contain"
              style={heroBg ? { filter: 'brightness(0) invert(1)' } : undefined}
            />
          ) : (
            <h1
              className="text-5xl md:text-7xl font-bold leading-tight"
              style={{
                color: heroBg ? '#fff' : accentColor,
                maxWidth: '16ch',
                lineHeight: '1.05',
              }}
            >
              {site.display_name ?? site.name}
            </h1>
          )}
          {site.tagline && (
            <p
              className="mt-4 text-lg md:text-xl italic"
              style={{
                color: heroBg ? 'rgba(255,255,255,0.85)' : '#444',
                maxWidth: '36ch',
                lineHeight: '1.4',
              }}
            >
              {site.tagline}
            </p>
          )}
          {site.location && (
            <p className="mt-4 text-sm" style={{ color: heroBg ? 'rgba(255,255,255,0.65)' : '#888' }}>
              {site.location}
            </p>
          )}
          {site.cta && (
            <div className="mt-6">
              <SiteCtaButton cta={site.cta} />
            </div>
          )}
        </div>
      </section>

      {/* ── BIO ── */}
      {site.sections.bio && site.bio && (
        <section className="py-16 md:py-20 border-b" style={{ borderColor: '#eee' }}>
          <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-[1fr_2fr] gap-12">
            <div>
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: accentColor }}>
                About
              </p>
            </div>
            <div>
              <p className="text-lg leading-relaxed" style={{ color: '#333' }}>
                {site.bio}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── EXHIBITIONS ── */}
      {site.sections.exhibitions && site.exhibitions.length > 0 && (
        <section id="exhibitions" className="py-16 md:py-20 border-b" style={{ borderColor: '#eee', background: '#f9f6f1' }}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid md:grid-cols-[1fr_2fr] gap-12">
              <div>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: accentColor }}>
                  Exhibitions
                </p>
              </div>
              <div>
                <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── WORKS ── */}
      {site.sections.artworks && site.artworks.length > 0 && (
        <section id="works" className="py-16 md:py-20 border-b" style={{ borderColor: '#eee' }}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-baseline justify-between mb-10">
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: accentColor }}>
                Works
              </p>
              <span className="text-xs" style={{ color: '#aaa' }}>
                {site.artworks.length} works
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-gray-200">
              {site.artworks.map((artwork) => (
                <div key={artwork.id} className="bg-white p-4">
                  <SiteArtworkCard artwork={artwork} handle={site.handle} accentColor={accentColor} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PRESS ── */}
      {site.sections.press && site.press.length > 0 && (
        <section id="press" className="py-16 md:py-20 border-b" style={{ borderColor: '#eee', background: '#f9f6f1' }}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid md:grid-cols-[1fr_2fr] gap-12">
              <div>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: accentColor }}>
                  Press
                </p>
              </div>
              <div>
                <SitePressList press={site.press} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT ── */}
      {site.sections.contact && (
        <section id="contact" className="py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid md:grid-cols-[1fr_2fr] gap-12">
              <div>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: accentColor }}>
                  Contact
                </p>
              </div>
              <div>
                <SiteContactBlock
                  name={site.name}
                  website={site.website}
                  location={site.location}
                  medium={site.medium}
                />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function resolveAccent(key: string): string {
  const map: Record<string, string> = {
    wine: '#4A2F25', slate: '#3D4B5C', forest: '#2D4A3E',
    sand: '#8B7355', midnight: '#1A1A2E', rose: '#8B4558',
  };
  return map[key] ?? '#4A2F25';
}

function resolveSurface(key: string | null): { bg: string; ink: string } {
  const map: Record<string, { bg: string; ink: string }> = {
    parchment: { bg: '#F5F1E8', ink: '#111111' },
    cream:     { bg: '#FAF7F0', ink: '#1A1A1A' },
    white:     { bg: '#FFFFFF', ink: '#111111' },
    slate:     { bg: '#F1F4F7', ink: '#0F1419' },
    charcoal:  { bg: '#1A1A1A', ink: '#F5F5F5' },
    ink:       { bg: '#0F0F12', ink: '#F0EBE0' },
  };
  return map[key ?? 'parchment'] ?? map.parchment;
}
