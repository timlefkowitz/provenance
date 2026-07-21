/**
 * Lightbox Template
 * Edge-to-edge photo grid: one column on mobile, tiled flush grid on desktop.
 */
import Image from 'next/image';
import type { SiteData } from '../types';
import { SiteArtworkLink } from '../_components/site-artwork-runtime';
import { SiteContactBlock } from '../_components/site-contact-block';
import { OrderedSections } from '../_components/ordered-sections';
import { EditableText } from '../_components/editable-text';
import { resolveAccent } from './palette';

export function LightboxTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);

  return (
    <div style={{ fontFamily: 'var(--site-font-body, system-ui, -apple-system, sans-serif)', color: '#111', background: '#000' }}>
      {/* Floating name overlay */}
      <div className="fixed top-0 inset-x-0 z-50 pointer-events-none">
        <div className="flex items-center justify-between px-4 py-3">
          <EditableText
            field="display_name"
            value={site.display_name ?? site.name}
            placeholder="Your name"
            as="span"
            className="text-[10px] uppercase tracking-[0.3em] text-white/80 mix-blend-difference pointer-events-auto"
          />
          {site.sections.contact && (
            <a href="#contact" className="text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white/90 transition-colors pointer-events-auto mix-blend-difference">Contact</a>
          )}
        </div>
      </div>

      <OrderedSections
        order={site.section_order}
        sections={site.sections}
        accentColor={accentColor}
        slots={{
          artworks: site.artworks.length > 0 ? (
            <section className="grid gap-0 w-full" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}>
              {site.artworks.map((artwork, i) => (
                <SiteArtworkLink key={artwork.id} artwork={artwork} className="group relative aspect-square overflow-hidden">
                  {artwork.image_url ? (
                    <Image src={artwork.image_url} alt={artwork.title} fill className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" unoptimized priority={i < 4} sizes="(max-width: 640px) 100vw, 33vw" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-xs text-white/30">No image</div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end p-3 opacity-0 group-hover:opacity-100">
                    <p className="text-[10px] text-white uppercase tracking-widest">{artwork.title}</p>
                  </div>
                </SiteArtworkLink>
              ))}
            </section>
          ) : undefined,

          bio: site.bio ? (
            <section className="px-6 py-12" style={{ background: '#0a0a0a' }}>
              <div className="max-w-lg mx-auto text-center">
                <EditableText field="bio" value={site.bio} placeholder="Write a short bio…" as="p" className="text-sm leading-relaxed text-white/50" />
              </div>
            </section>
          ) : undefined,

          exhibitions: site.exhibitions.length > 0 ? (
            <section className="px-6 py-12" style={{ background: '#0a0a0a' }}>
              <div className="max-w-lg mx-auto">
                <p className="text-[10px] uppercase tracking-[0.25em] mb-6 text-center" style={{ color: accentColor }}>Exhibitions</p>
                <div className="space-y-4">
                  {site.exhibitions.map((ex) => (
                    <div key={ex.id} className="text-center">
                      <p className="text-sm text-white/70">{ex.title}</p>
                      <p className="text-[10px] text-white/35 mt-0.5">{new Date(ex.start_date).getFullYear()}{ex.location ? ` · ${ex.location}` : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : undefined,

          press: site.press.length > 0 ? (
            <section className="px-6 py-12" style={{ background: '#0a0a0a' }}>
              <div className="max-w-lg mx-auto">
                <p className="text-[10px] uppercase tracking-[0.25em] mb-6 text-center" style={{ color: accentColor }}>Press</p>
                <div className="space-y-3">
                  {site.press.map((item, i) => (
                    <a key={i} href={item.url} target="_blank" rel="noreferrer" className="block text-center hover:opacity-70 transition-opacity">
                      <p className="text-xs text-white/60">{item.title}</p>
                      {item.publication_name && <p className="text-[10px] text-white/30">{item.publication_name}</p>}
                    </a>
                  ))}
                </div>
              </div>
            </section>
          ) : undefined,

          contact: (
            <footer id="contact" className="px-6 py-16" style={{ background: '#0a0a0a', color: '#ccc' }}>
              <div className="max-w-lg mx-auto text-center">
                <p className="text-[10px] uppercase tracking-[0.25em] mb-6" style={{ color: accentColor }}>Contact</p>
                <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
              </div>
            </footer>
          ),
        }}
      />
    </div>
  );
}
