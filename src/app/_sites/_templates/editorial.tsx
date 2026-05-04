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
  const heroBg = site.picture_url ?? null;
  const accentColor = resolveAccent(site.theme.accent);

  return (
    <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: '#111', background: '#fff' }}>

      {/* ── NAV ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: '#fff', borderColor: '#e8e8e8' }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-lg font-bold tracking-tight" style={{ color: accentColor }}>
            {site.name}
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
          <h1
            className="text-5xl md:text-7xl font-bold leading-tight"
            style={{
              color: heroBg ? '#fff' : accentColor,
              maxWidth: '16ch',
              lineHeight: '1.05',
            }}
          >
            {site.name}
          </h1>
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
