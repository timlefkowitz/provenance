/**
 * Atelier Template
 * Single-page narrative scroll: Hero → About → Selected Works → Press → Contact.
 * Generous whitespace, story-driven. Best for collectors, curators, and artists
 * who want a personal narrative rather than a catalogue grid.
 */
import Image from 'next/image';
import type { SiteData } from '../types';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';

export function AtelierTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  // Featured works: up to 6, in a 2-column staggered layout
  const featuredWorks = site.artworks.slice(0, 6);

  return (
    <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: '#1a1a1a', background: '#faf9f7' }}>

      {/* ── HERO (full-viewport) ── */}
      <section
        className="relative flex flex-col justify-between"
        style={{ minHeight: '100svh', background: '#1a1a1a' }}
      >
        {/* Background artwork image */}
        {site.artworks[0]?.image_url && (
          <div className="absolute inset-0">
            <Image
              src={site.artworks[0].image_url}
              alt={site.name}
              fill
              className="object-cover opacity-30"
              unoptimized
              priority
            />
          </div>
        )}

        {/* Top bar */}
        <div className="relative z-10 max-w-4xl mx-auto w-full px-8 pt-10 flex items-center justify-between">
          <span
            className="text-xs uppercase tracking-[0.3em]"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            {site.medium || site.role}
          </span>
          <nav className="flex gap-6">
            {site.sections.artworks && site.artworks.length > 0 && (
              <a href="#works" className="text-xs uppercase tracking-[0.2em] transition-opacity hover:opacity-60" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Works
              </a>
            )}
            {site.sections.press && site.press.length > 0 && (
              <a href="#press" className="text-xs uppercase tracking-[0.2em] transition-opacity hover:opacity-60" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Press
              </a>
            )}
            {site.sections.contact && (
              <a href="#contact" className="text-xs uppercase tracking-[0.2em] transition-opacity hover:opacity-60" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Contact
              </a>
            )}
          </nav>
        </div>

        {/* Hero name */}
        <div className="relative z-10 max-w-4xl mx-auto w-full px-8 pb-16">
          <h1
            className="text-6xl md:text-8xl font-bold leading-none"
            style={{ color: '#fff', letterSpacing: '-0.02em' }}
          >
            {site.name}
          </h1>
          {site.location && (
            <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {site.location}
            </p>
          )}
          {site.cta && (
            <div className="mt-8">
              <SiteCtaButton cta={site.cta} />
            </div>
          )}
        </div>

        {/* Scroll cue */}
        <div className="relative z-10 max-w-4xl mx-auto w-full px-8 pb-8 flex justify-center">
          <span
            className="text-xs uppercase tracking-[0.3em]"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            ↓ Scroll
          </span>
        </div>
      </section>

      {/* ── ABOUT ── */}
      {site.sections.bio && site.bio && (
        <section className="py-24 md:py-32">
          <div className="max-w-3xl mx-auto px-8">
            <div className="flex items-center gap-4 mb-12">
              {site.picture_url && (
                <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-2" style={{ borderColor: accentColor }}>
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
                <p className="text-xs uppercase tracking-[0.2em] mb-1" style={{ color: '#aaa' }}>
                  About
                </p>
                <p className="text-sm font-semibold" style={{ fontFamily: 'system-ui, sans-serif', color: '#333' }}>
                  {site.name}
                </p>
              </div>
            </div>
            <p
              className="text-xl md:text-2xl leading-relaxed"
              style={{ color: '#333', lineHeight: '1.7' }}
            >
              {site.bio}
            </p>
          </div>
        </section>
      )}

      {/* ── SELECTED WORKS ── */}
      {site.sections.artworks && featuredWorks.length > 0 && (
        <section id="works" className="py-16 md:py-24 border-t" style={{ borderColor: '#e8e4dc' }}>
          <div className="max-w-4xl mx-auto px-8">
            <p className="text-xs uppercase tracking-[0.2em] mb-14" style={{ color: accentColor }}>
              Selected Works
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14">
              {featuredWorks.map((artwork, i) => (
                <div
                  key={artwork.id}
                  className={i % 3 === 1 ? 'md:mt-14' : ''} // stagger effect
                >
                  <div className="relative aspect-[4/5] overflow-hidden mb-4 bg-gray-100">
                    {artwork.image_url ? (
                      <Image
                        src={artwork.image_url}
                        alt={artwork.title}
                        fill
                        className="object-cover"
                        unoptimized
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs" style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>No image</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium" style={{ fontFamily: 'system-ui, sans-serif', color: '#111' }}>
                    {artwork.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ fontFamily: 'system-ui, sans-serif', color: '#999' }}>
                    {new Date(artwork.created_at).getFullYear()}
                  </p>
                </div>
              ))}
            </div>

            {site.artworks.length > 6 && (
              <p className="mt-14 text-xs" style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
                + {site.artworks.length - 6} more works
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── EXHIBITIONS ── */}
      {site.sections.exhibitions && site.exhibitions.length > 0 && (
        <section className="py-16 md:py-24 border-t" style={{ borderColor: '#e8e4dc' }}>
          <div className="max-w-4xl mx-auto px-8">
            <p className="text-xs uppercase tracking-[0.2em] mb-10" style={{ color: accentColor }}>
              Exhibitions
            </p>
            <div className="space-y-6">
              {site.exhibitions.map((ex) => (
                <div key={ex.id} className="flex flex-col gap-1">
                  <p className="text-base font-medium" style={{ fontFamily: 'system-ui, sans-serif', color: '#111' }}>
                    {ex.title}
                  </p>
                  <p className="text-xs" style={{ fontFamily: 'system-ui, sans-serif', color: '#999' }}>
                    {new Date(ex.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                    {ex.end_date ? ` – ${new Date(ex.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}` : ''}
                    {ex.location ? ` · ${ex.location}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PRESS ── */}
      {site.sections.press && site.press.length > 0 && (
        <section id="press" className="py-16 md:py-24 border-t" style={{ borderColor: '#e8e4dc' }}>
          <div className="max-w-4xl mx-auto px-8">
            <p className="text-xs uppercase tracking-[0.2em] mb-10" style={{ color: accentColor }}>
              Press
            </p>
            <div className="max-w-lg">
              <SitePressList press={site.press} />
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT ── */}
      {site.sections.contact && (
        <section id="contact" className="py-16 md:py-24 border-t" style={{ borderColor: '#e8e4dc', background: '#f0ede8' }}>
          <div className="max-w-4xl mx-auto px-8">
            <p className="text-xs uppercase tracking-[0.2em] mb-10" style={{ color: accentColor }}>
              Contact
            </p>
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
