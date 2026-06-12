/**
 * Lightbox Template
 * Edge-to-edge photo grid: one column on mobile, tiled flush grid on desktop.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SiteContactBlock } from '../_components/site-contact-block';
import { resolveAccent } from './palette';

export function LightboxTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const displayName = site.display_name ?? site.name;

  return (
    <div style={{ fontFamily: 'var(--site-font-body, system-ui, -apple-system, sans-serif)', color: '#111', background: '#000' }}>
      {/* Floating name overlay */}
      <div className="fixed top-0 inset-x-0 z-50 pointer-events-none">
        <div className="flex items-center justify-between px-4 py-3">
          <span
            className="text-[10px] uppercase tracking-[0.3em] text-white/80 mix-blend-difference"
          >
            {displayName}
          </span>
          {site.sections.contact && (
            <a
              href="#contact"
              className="text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white/90 transition-colors pointer-events-auto mix-blend-difference"
            >
              Contact
            </a>
          )}
        </div>
      </div>

      {site.sections.artworks && site.artworks.length > 0 && (
        <section
          className="grid gap-0 w-full"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
          }}
        >
          {site.artworks.map((artwork, i) => (
            <Link
              key={artwork.id}
              href={`/works/${artwork.id}`}
              className="group relative aspect-square overflow-hidden"
            >
              {artwork.image_url ? (
                <Image
                  src={artwork.image_url}
                  alt={artwork.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  unoptimized
                  priority={i < 4}
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-xs text-white/30">
                  No image
                </div>
              )}
              <div
                className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end p-3 opacity-0 group-hover:opacity-100"
              >
                <p className="text-[10px] text-white uppercase tracking-widest">{artwork.title}</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {(site.sections.bio || site.sections.contact) && (
        <footer
          id="contact"
          className="px-6 py-16"
          style={{ background: '#0a0a0a', color: '#ccc' }}
        >
          <div className="max-w-lg mx-auto text-center">
            {site.sections.bio && site.bio && (
              <p className="text-sm leading-relaxed mb-10 text-white/50">{site.bio}</p>
            )}
            {site.sections.contact && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] mb-6" style={{ color: accentColor }}>
                  Contact
                </p>
                <SiteContactBlock
                  name={site.name}
                  website={site.website}
                  location={site.location}
                  medium={site.medium}
                />
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
