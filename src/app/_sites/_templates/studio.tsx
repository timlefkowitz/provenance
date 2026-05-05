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

export function StudioTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color);
  const isDarkSurface = ['charcoal', 'ink'].includes(site.surface_color ?? '');

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: surface.ink, background: surface.bg }}>

      {/* ── HERO BANNER (optional) ── */}
      {site.hero_image_url && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden border-b" style={{ borderColor: isDarkSurface ? '#333' : '#e4e4e4' }}>
          <Image
            src={site.hero_image_url}
            alt={site.name}
            fill
            className="object-cover"
            unoptimized
            priority
          />
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="border-b" style={{ borderColor: isDarkSurface ? '#333' : '#e4e4e4' }}>
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
                <img
                  src={site.logo_image_url}
                  alt={site.display_name ?? site.name}
                  className="h-7 w-auto object-contain"
                />
              ) : (
                <h1 className="text-base font-semibold tracking-tight" style={{ color: surface.ink }}>
                  {site.display_name ?? site.name}
                </h1>
              )}
              {site.tagline ? (
                <p className="text-xs mt-0.5" style={{ color: isDarkSurface ? 'rgba(255,255,255,0.6)' : '#888' }}>
                  {site.tagline}
                </p>
              ) : (site.medium || site.location) ? (
                <p className="text-xs mt-0.5" style={{ color: isDarkSurface ? 'rgba(255,255,255,0.6)' : '#888' }}>
                  {[site.medium, site.location].filter(Boolean).join(' · ')}
                </p>
              ) : null}
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
            {site.cta && <SiteCtaButton cta={site.cta} />}
          </nav>
        </div>
      </header>

      {/* ── BIO ── */}
      {site.sections.bio && site.bio && (
        <section className="max-w-6xl mx-auto px-6 py-10 border-b" style={{ borderColor: '#e4e4e4' }}>
          <p className="text-sm leading-relaxed max-w-2xl" style={{ color: '#444' }}>
            {site.bio}
          </p>
        </section>
      )}

      {/* ── WORKS (dominant grid) ── */}
      {site.sections.artworks && site.artworks.length > 0 && (
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
      )}

      {/* ── EXHIBITIONS ── */}
      {site.sections.exhibitions && site.exhibitions.length > 0 && (
        <section id="exhibitions" className="border-t" style={{ borderColor: '#e4e4e4' }}>
          <div className="max-w-6xl mx-auto px-6 py-10">
            <span className="block text-xs uppercase tracking-[0.15em] mb-6" style={{ color: accentColor }}>
              Exhibitions
            </span>
            <SiteExhibitionList exhibitions={site.exhibitions} handle={site.handle} />
          </div>
        </section>
      )}

      {/* ── PRESS ── */}
      {site.sections.press && site.press.length > 0 && (
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
      )}

      {/* ── CONTACT ── */}
      {site.sections.contact && (
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
  return map[key ?? 'white'] ?? map.white;
}
