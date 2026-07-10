/**
 * Folio Template
 * Narrow centered column — one work after another, book-like rhythm.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { SitePressList } from '../_components/site-press-list';
import { SiteContactBlock } from '../_components/site-contact-block';
import { SiteCtaButton } from '../_components/site-cta-button';
import { resolveAccent, resolveSurface } from './palette';

export function FolioTemplate({ site }: { site: SiteData }) {
  const accentColor = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color ?? 'cream');
  const displayName = site.display_name ?? site.name;

  return (
    <div style={{ fontFamily: 'var(--site-font-body, Georgia, "Times New Roman", serif)', color: surface.ink, background: surface.bg }}>
      <header className="max-w-md mx-auto px-6 pt-16 pb-10 text-center">
        {site.logo_image_url ? (
          <Image src={site.logo_image_url} alt={displayName} width={0} height={0} sizes="100vw" className="h-8 w-auto object-contain mx-auto mb-4" />
        ) : (
          <h1 className="text-xl font-normal tracking-wide">{displayName}</h1>
        )}
        {site.tagline && <p className="text-xs mt-2 italic" style={{ color: '#888' }}>{site.tagline}</p>}
        <nav className="flex items-center justify-center gap-5 mt-8">
          {site.sections.artworks && site.artworks.length > 0 && (
            <a href="#works" className="text-[10px] uppercase tracking-[0.2em] hover:opacity-60" style={{ color: accentColor }}>Works</a>
          )}
          {site.sections.contact && (
            <a href="#contact" className="text-[10px] uppercase tracking-[0.2em] hover:opacity-60" style={{ color: accentColor }}>Contact</a>
          )}
          {site.cta && <SiteCtaButton cta={site.cta} />}
        </nav>
      </header>

      {site.sections.bio && site.bio && (
        <section className="max-w-md mx-auto px-6 pb-14">
          <p className="text-sm leading-[1.8] text-center" style={{ color: '#555' }}>{site.bio}</p>
        </section>
      )}

      {site.sections.artworks && site.artworks.length > 0 && (
        <section id="works" className="max-w-md mx-auto px-6">
          {site.artworks.map((artwork, i) => (
            <article key={artwork.id} className="mb-20 last:mb-0">
              <Link href={`/works/${artwork.id}`} className="group block">
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-100">
                  {artwork.image_url ? (
                    <Image
                      src={artwork.image_url}
                      alt={artwork.title}
                      fill
                      className="object-cover transition-opacity duration-500 group-hover:opacity-90"
                      unoptimized
                      priority={i < 2}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">No image</div>
                  )}
                </div>
                <figcaption className="mt-5 text-center">
                  <p className="text-sm italic">{artwork.title}</p>
                  <p className="text-[10px] uppercase tracking-[0.15em] mt-2" style={{ color: '#aaa' }}>
                    {new Date(artwork.created_at).getFullYear()}
                  </p>
                </figcaption>
              </Link>
            </article>
          ))}
        </section>
      )}

      {site.sections.press && site.press.length > 0 && (
        <section className="max-w-md mx-auto px-6 py-16 mt-10 border-t" style={{ borderColor: '#e8e8e8' }}>
          <p className="text-[10px] uppercase tracking-[0.2em] mb-6 text-center" style={{ color: accentColor }}>Press</p>
          <SitePressList press={site.press} />
        </section>
      )}

      {site.sections.contact && (
        <section id="contact" className="max-w-md mx-auto px-6 py-16 text-center border-t" style={{ borderColor: '#e8e8e8' }}>
          <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
        </section>
      )}
    </div>
  );
}
