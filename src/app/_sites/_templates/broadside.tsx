/**
 * Broadside Template
 * Contino NY-inspired zine/broadsheet energy: a running marquee ticker,
 * offset asymmetric artwork grid, footnote-style bracketed press, and a
 * masthead treatment mixing serif display type with monospace metadata.
 * Best fit for artists and galleries who want an editorial, dispatch-like feel.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { resolveAccent, resolveSurface, mutedText, borderColor } from './palette';
import { SiteContactBlock } from '../_components/site-contact-block';
import { OrderedSections } from '../_components/ordered-sections';
import { EditableText } from '../_components/editable-text';
import { EditableImage } from '../_components/editable-image';
import { EditableCta } from '../_components/editable-cta';

function yearOf(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : String(d.getFullYear());
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

function fmtPrice(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return '';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency ?? '$'} ${amount}`;
  }
}

export function BroadsideTemplate({ site }: { site: SiteData }) {
  const accent = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color, site.theme.text_color);
  const muted = mutedText(site.surface_color, site.theme.text_color);
  const hairline = borderColor(site.surface_color);
  const headingFont = 'var(--site-font-heading, ui-serif, Georgia, Cambria, "Times New Roman", serif)';
  const bodyFont = 'var(--site-font-body, ui-serif, Georgia, Cambria, "Times New Roman", serif)';

  const displayName = site.display_name ?? site.name;

  const showBio = site.sections.bio && !!site.bio;
  const showArtworks = site.sections.artworks && site.artworks.length > 0;
  const showExhibitions = site.sections.exhibitions && site.exhibitions.length > 0;
  const showPress = site.sections.press && site.press.length > 0;
  const showContact = site.sections.contact && (!!site.website || !!site.location || !!site.cta);

  const tickerItems = [
    site.role?.toUpperCase(),
    site.location,
    site.medium,
    `@${site.handle}`,
    site.tagline,
  ].filter(Boolean) as string[];

  return (
    <div
      style={{ backgroundColor: surface.bg, color: surface.ink, fontFamily: bodyFont }}
      className="min-h-screen w-full antialiased selection:text-white"
    >
      {/* Ticker */}
      {tickerItems.length > 0 && (
        <div style={{ borderColor: hairline }} className="border-b overflow-hidden" aria-hidden="true">
          <div className="flex whitespace-nowrap py-2 font-mono text-[11px] uppercase tracking-[0.2em] animate-[broadsideMarquee_40s_linear_infinite]">
            {[...tickerItems, ...tickerItems, ...tickerItems].map((t, i) => (
              <span key={i} className="mx-6 inline-flex items-center gap-6">
                {t}
                <span style={{ backgroundColor: accent }} className="inline-block h-1.5 w-1.5 rounded-full" />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Masthead */}
      <header style={{ borderColor: hairline }} className="border-b px-5 md:px-10 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {site.logo_image_url ? (
            <EditableImage field="logo">
              <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full" style={{ outline: `1px solid ${surface.ink}` }}>
                <Image src={site.logo_image_url} alt={`${displayName} logo`} fill className="object-cover" unoptimized />
              </div>
            </EditableImage>
          ) : null}
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: muted }}>
              No. {site.handle} — Vol. {new Date().getFullYear()}
            </div>
            <div className="truncate text-lg md:text-xl font-semibold tracking-tight" style={{ fontFamily: headingFont }}>
              <EditableText field="display_name" value={displayName} placeholder="Your name" as="span" />
            </div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em]">
          {showBio && <a href="#dossier" className="hover:opacity-60">Dossier</a>}
          {showArtworks && <a href="#works" className="hover:opacity-60">Works</a>}
          {showExhibitions && <a href="#shows" className="hover:opacity-60">Shows</a>}
          {showPress && <a href="#press" className="hover:opacity-60">Press</a>}
          {showContact && <a href="#contact" className="hover:opacity-60">Contact</a>}
        </nav>
      </header>

      {/* Hero — offset broadside */}
      <section className="relative px-5 md:px-10 pt-10 md:pt-16 pb-16 md:pb-24">
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <div className="col-span-12 md:col-span-7 relative z-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: muted }}>
              {site.role} / dispatch
            </div>
            <h1
              className="mt-3 italic leading-[0.92] tracking-tight text-[14vw] md:text-[9vw]"
              style={{ fontFamily: headingFont }}
            >
              <EditableText field="display_name" value={displayName} placeholder="Your name" as="span" />
            </h1>
            <p className="mt-6 max-w-xl text-lg md:text-2xl leading-snug">
              <span style={{ backgroundColor: accent }} className="inline-block h-3 w-3 -translate-y-1 mr-2 rounded-full" />
              <EditableText field="tagline" value={site.tagline} placeholder="Your tagline…" as="span" />
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em]">
              {site.location && (
                <span style={{ borderColor: surface.ink }} className="border px-2.5 py-1">
                  ↳ {site.location}
                </span>
              )}
              {site.medium && (
                <span style={{ borderColor: surface.ink }} className="border px-2.5 py-1">
                  medium — {site.medium}
                </span>
              )}
              {site.cta && (
                <EditableCta cta={site.cta}>
                  <a
                    href={site.cta.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ backgroundColor: accent, color: '#fff' }}
                    className="inline-block px-3 py-1.5 hover:opacity-90"
                  >
                    {site.cta.label} →
                  </a>
                </EditableCta>
              )}
            </div>
          </div>

          <div className="col-span-12 md:col-span-5 relative">
            {site.hero_image_url ? (
              <EditableImage field="hero">
                <figure className="relative md:-mt-6">
                  <div className="relative w-full aspect-[4/5]">
                    <Image
                      src={site.hero_image_url}
                      alt={`${displayName} — feature image`}
                      fill
                      className="object-cover"
                      style={{ outline: `1px solid ${surface.ink}` }}
                      unoptimized
                      priority
                    />
                  </div>
                  <figcaption
                    style={{ backgroundColor: surface.bg, borderColor: surface.ink, color: surface.ink }}
                    className="absolute -bottom-4 -left-4 md:-left-10 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] max-w-[80%]"
                  >
                    Fig. 01 — Cover plate for the current dispatch.
                  </figcaption>
                  <span style={{ backgroundColor: accent }} className="absolute -top-3 -right-3 h-8 w-8 rounded-full" aria-hidden="true" />
                </figure>
              </EditableImage>
            ) : (
              <div
                style={{ borderColor: surface.ink }}
                className="w-full aspect-[4/5] border border-dashed flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.2em]"
              >
                no plate
              </div>
            )}
          </div>
        </div>

        {/* rule + folio */}
        <div className="mt-16 flex items-end justify-between font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: muted }}>
          <span>§ 01 — Masthead</span>
          <span>p. 01</span>
        </div>
      </section>

      <OrderedSections
        order={site.section_order}
        sections={site.sections}
        accentColor={accent}
        slots={{
          /* Bio / Dossier */
          bio: showBio ? (
            <section id="dossier" style={{ borderColor: hairline }} className="border-t px-5 md:px-10 py-14 md:py-20">
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-3">
                  <div className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: muted }}>§ 02</div>
                  <h2 className="mt-2 text-3xl md:text-5xl tracking-tight" style={{ fontFamily: headingFont }}>Dossier</h2>
                  {site.picture_url && (
                    <div className="relative mt-6 w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden" style={{ outline: `2px solid ${surface.ink}` }}>
                      <Image src={site.picture_url} alt={`Portrait of ${displayName}`} fill className="object-cover" unoptimized />
                    </div>
                  )}
                </div>
                <div className="col-span-12 md:col-span-9 md:pl-8" style={{ borderColor: hairline }}>
                  <div className="md:border-l md:pl-8" style={{ borderColor: hairline }}>
                    <p
                      className="text-lg md:text-2xl leading-relaxed first-letter:float-left first-letter:mr-3 first-letter:text-6xl md:first-letter:text-7xl first-letter:font-semibold first-letter:leading-[0.85]"
                      style={{ fontFamily: headingFont }}
                    >
                      <EditableText field="bio" value={site.bio} placeholder="Write a short bio…" as="span" />
                    </p>
                    <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-[11px] uppercase tracking-[0.2em]">
                      <div><div style={{ color: muted }}>Role</div><div className="mt-1">{site.role}</div></div>
                      {site.medium && <div><div style={{ color: muted }}>Medium</div><div className="mt-1">{site.medium}</div></div>}
                      {site.location && <div><div style={{ color: muted }}>Based</div><div className="mt-1">{site.location}</div></div>}
                      <div><div style={{ color: muted }}>Handle</div><div className="mt-1">@{site.handle}</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : undefined,

          /* Artworks — offset broadsheet grid */
          artworks: showArtworks ? (
            <section id="works" style={{ borderColor: hairline }} className="border-t px-5 md:px-10 py-14 md:py-20">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: muted }}>§ 03</div>
                  <h2 className="mt-2 text-3xl md:text-5xl tracking-tight" style={{ fontFamily: headingFont }}>Plates &amp; Editions</h2>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: muted }}>
                  {site.artworks.length} items on record
                </span>
              </div>

              <ol className="grid grid-cols-12 gap-x-6 gap-y-14">
                {site.artworks.map((a, i) => {
                  const offset = i % 4;
                  const spans = ['md:col-span-5', 'md:col-span-6 md:col-start-7', 'md:col-span-7', 'md:col-span-4 md:col-start-8'];
                  const nudges = ['', 'md:mt-16', 'md:-mt-6', 'md:mt-24'];
                  const year = yearOf(a.created_at);
                  const sold = !!a.sold_at;
                  return (
                    <li key={a.id} className={`col-span-12 ${spans[offset]} ${nudges[offset]} group relative`}>
                      <Link href={`/works/${a.id}`} className="block">
                        <figure className="relative">
                          {a.image_url ? (
                            <div className="relative w-full aspect-[4/5]">
                              <Image
                                src={a.image_url}
                                alt={`${a.title}${a.artist_name ? ' by ' + a.artist_name : ''}`}
                                fill
                                className="object-cover"
                                style={{ outline: `1px solid ${surface.ink}` }}
                                unoptimized
                                loading="lazy"
                                sizes="(max-width: 768px) 100vw, 58vw"
                              />
                            </div>
                          ) : (
                            <div style={{ borderColor: surface.ink }} className="w-full aspect-[4/5] border border-dashed" />
                          )}
                          {sold ? (
                            <span
                              style={{ backgroundColor: surface.ink, color: surface.bg }}
                              className="absolute top-3 left-3 font-mono text-[10px] uppercase tracking-[0.25em] px-2 py-1"
                            >
                              Sold
                            </span>
                          ) : a.for_sale && a.sale_price != null ? (
                            <span
                              style={{ backgroundColor: accent, color: '#fff' }}
                              className="absolute top-3 left-3 font-mono text-[10px] uppercase tracking-[0.25em] px-2 py-1"
                            >
                              {fmtPrice(a.sale_price, a.sale_currency)}
                            </span>
                          ) : null}
                          <figcaption
                            style={{ backgroundColor: surface.bg, borderColor: surface.ink }}
                            className="absolute -bottom-5 left-4 right-4 md:left-6 md:right-auto md:max-w-[75%] border p-3"
                          >
                            <div className="flex items-baseline justify-between gap-4">
                              <div className="min-w-0">
                                <div className="italic text-xl md:text-2xl leading-tight truncate" style={{ fontFamily: headingFont }}>
                                  {a.title}
                                </div>
                                {a.artist_name && (
                                  <div className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: muted }}>
                                    {a.artist_name}
                                  </div>
                                )}
                              </div>
                              <div className="font-mono text-[10px] uppercase tracking-[0.2em] shrink-0" style={{ color: muted }}>
                                {year}
                              </div>
                            </div>
                            <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.25em]" style={{ color: muted }}>
                              Cert № {a.certificate_number}
                            </div>
                          </figcaption>
                        </figure>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : undefined,

          /* Exhibitions — annotated schedule */
          exhibitions: showExhibitions ? (
            <section id="shows" style={{ borderColor: hairline }} className="border-t px-5 md:px-10 py-14 md:py-20">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: muted }}>§ 04</div>
                  <h2 className="mt-2 text-3xl md:text-5xl tracking-tight" style={{ fontFamily: headingFont }}>On View / Elsewhere</h2>
                </div>
              </div>
              <ul className="divide-y" style={{ borderColor: hairline }}>
                {site.exhibitions.map((ex, i) => (
                  <li key={ex.id} className="border-b" style={{ borderColor: hairline }}>
                    <Link
                      href={`/exhibitions/${ex.id}`}
                      className="group grid grid-cols-1 items-baseline gap-2 py-6 md:grid-cols-12 md:gap-4 transition-opacity hover:opacity-70"
                      style={{ color: surface.ink }}
                    >
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em] md:col-span-1" style={{ color: muted }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h4 className="italic leading-tight md:col-span-6 text-2xl md:text-3xl" style={{ fontFamily: headingFont }}>
                        {ex.title}
                      </h4>
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em] md:col-span-3">
                        {fmtDate(ex.start_date)}{ex.end_date ? ` → ${fmtDate(ex.end_date)}` : ''}
                      </span>
                      {ex.location ? (
                        <span className="italic md:col-span-2 md:text-right" style={{ color: muted }}>
                          {ex.location}
                        </span>
                      ) : (
                        <span className="md:col-span-2" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : undefined,

          /* Press — footnote strip */
          press: showPress ? (
            <section id="press" style={{ borderColor: hairline }} className="border-t px-5 md:px-10 py-14 md:py-20">
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-3">
                  <div className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: muted }}>§ 05</div>
                  <h2 className="mt-2 text-3xl md:text-5xl tracking-tight" style={{ fontFamily: headingFont }}>Cuttings</h2>
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: muted }}>
                    Notes from the record.
                  </p>
                </div>
                <ol className="col-span-12 md:col-span-9 space-y-4 font-mono text-sm md:text-base">
                  {site.press.map((p, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="w-8 shrink-0 tabular-nums" style={{ color: accent }}>
                        [{String(i + 1).padStart(2, '0')}]
                      </span>
                      <a href={p.url} target="_blank" rel="noreferrer" className="group underline-offset-4 hover:underline">
                        <span className="italic text-lg md:text-xl" style={{ fontFamily: headingFont }}>{p.title}</span>
                        <span className="ml-2 text-[11px] uppercase tracking-[0.2em]" style={{ color: muted }}>
                          {p.publication_name}{p.date ? ` — ${p.date}` : ''}
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ) : undefined,

          /* Contact / Colophon */
          contact: (
            <section id="contact" style={{ borderColor: hairline }} className="border-t px-5 md:px-10 py-16 md:py-24">
              <div className="grid grid-cols-12 gap-6 items-end">
                <div className="col-span-12 md:col-span-8">
                  <div className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: muted }}>§ 06 — Colophon</div>
                  <p className="mt-4 italic leading-[0.95] tracking-tight text-[12vw] md:text-[7vw]" style={{ fontFamily: headingFont }}>
                    Write to
                    <br />
                    the desk.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3 font-mono text-[11px] uppercase tracking-[0.2em]">
                    {site.website && (
                      <a href={site.website} style={{ borderColor: surface.ink }} className="border px-3 py-1.5 hover:opacity-70">
                        {site.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {site.location && (
                      <span style={{ borderColor: surface.ink }} className="border px-3 py-1.5">
                        {site.location}
                      </span>
                    )}
                    {site.cta && (
                      <EditableCta cta={site.cta}>
                        <a
                          href={site.cta.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ backgroundColor: accent, color: '#fff' }}
                          className="inline-block px-3 py-1.5 hover:opacity-90"
                        >
                          {site.cta.label} →
                        </a>
                      </EditableCta>
                    )}
                  </div>
                  {!site.website && !site.location && !site.cta && (
                    <div className="mt-6">
                      <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
                    </div>
                  )}
                </div>
                <div className="col-span-12 md:col-span-4 font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: muted }}>
                  <div>Accent: <span style={{ color: accent }}>{accent}</span></div>
                  <div>Surface: {site.surface_color || 'parchment'}</div>
                  <div className="mt-3">© {new Date().getFullYear()} {displayName}. All plates reserved.</div>
                </div>
              </div>
            </section>
          ),
        }}
      />

      {/* Footer rule */}
      <footer
        style={{ borderColor: hairline, color: muted }}
        className="border-t px-5 md:px-10 py-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em]"
      >
        <span>Broadside</span>
        {!site.is_white_label && <span>Powered by provenance.guru</span>}
      </footer>

      <style>{`
        @keyframes broadsideMarquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-33.3333%); }
        }
      `}</style>
    </div>
  );
}
