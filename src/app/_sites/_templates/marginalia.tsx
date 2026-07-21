/**
 * Marginalia Template
 * An annotated scholar's-manuscript vibe: sticky running head, drop-cap
 * body copy, footnote-numbered plates, dotted-leader exhibition index, and
 * a single accent color used like a red-pencil edit mark in the margins.
 * Best fit for painters, writers, and archives with a literary voice.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteArtworkLink } from '../_components/site-artwork-runtime';
import type { SiteData } from '../types';
import { resolveAccent, resolveSurface, mutedText, borderColor } from './palette';
import { SiteContactBlock } from '../_components/site-contact-block';
import { OrderedSections } from '../_components/ordered-sections';
import { EditableText } from '../_components/editable-text';
import { EditableImage } from '../_components/editable-image';
import { EditableCta } from '../_components/editable-cta';

const SECTION_NUMERALS: Record<'bio' | 'artworks' | 'exhibitions' | 'press' | 'contact', string> = {
  bio: 'II',
  artworks: 'III',
  exhibitions: 'IV',
  press: 'V',
  contact: 'VI',
};

function yearOf(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso.slice(0, 4) : String(d.getFullYear());
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
    return `${currency ?? '$'}${amount.toLocaleString()}`;
  }
}

function fmtExhibitionRange(start: string, end: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };
  const s = new Date(start);
  const sStr = isNaN(s.getTime()) ? start : s.toLocaleDateString('en-US', opts);
  if (!end) return sStr;
  const e = new Date(end);
  const eStr = isNaN(e.getTime()) ? end : e.toLocaleDateString('en-US', opts);
  return `${sStr} — ${eStr}`;
}

export function MarginaliaTemplate({ site }: { site: SiteData }) {
  const accent = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color, site.theme.text_color);
  const muted = mutedText(site.surface_color, site.theme.text_color);
  const hairline = borderColor(site.surface_color);
  const headingFont =
    'var(--site-font-heading, "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif)';
  const bodyFont =
    'var(--site-font-body, "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif)';

  const displayName = site.display_name ?? site.name;

  const showBio = site.sections.bio && !!site.bio;
  const showArtworks = site.sections.artworks && site.artworks.length > 0;
  const showExhibitions = site.sections.exhibitions && site.exhibitions.length > 0;
  const showPress = site.sections.press && site.press.length > 0;
  const showContact = site.sections.contact && (!!site.website || !!site.cta || !!site.handle);

  const runningHead = `${displayName} · ${(site.role ?? '').toUpperCase()}${
    site.location ? ` · ${site.location}` : ''
  }`;

  return (
    <div
      style={{ backgroundColor: surface.bg, color: surface.ink, fontFamily: bodyFont }}
      className="min-h-screen w-full antialiased"
    >
      {/* Running head — sticky top strip, like a book's page header */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{ borderColor: hairline, backgroundColor: `${surface.bg}ee` }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.28em] sm:px-10">
          <div className="flex min-w-0 items-center gap-3">
            {site.logo_image_url ? (
              <EditableImage field="logo">
                <div className="relative h-5 w-12 flex-shrink-0">
                  <Image
                    src={site.logo_image_url}
                    alt={`${displayName} logo`}
                    fill
                    className="object-contain object-left"
                    unoptimized
                  />
                </div>
              </EditableImage>
            ) : (
              <span
                className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
                aria-hidden="true"
              />
            )}
            <span className="hidden truncate sm:inline" style={{ color: muted }}>
              {runningHead}
            </span>
            <span className="truncate sm:hidden" style={{ color: muted }}>
              {displayName}
            </span>
          </div>
          <nav aria-label="Sections" className="hidden flex-shrink-0 gap-5 md:flex">
            {showBio && (
              <a href="#bio" className="hover:underline" style={{ color: muted }}>
                § {SECTION_NUMERALS.bio} Bio
              </a>
            )}
            {showArtworks && (
              <a href="#plates" className="hover:underline" style={{ color: muted }}>
                § {SECTION_NUMERALS.artworks} Works
              </a>
            )}
            {showExhibitions && (
              <a href="#record" className="hover:underline" style={{ color: muted }}>
                § {SECTION_NUMERALS.exhibitions} Exhibitions
              </a>
            )}
            {showPress && (
              <a href="#citations" className="hover:underline" style={{ color: muted }}>
                § {SECTION_NUMERALS.press} Press
              </a>
            )}
            {showContact && (
              <a href="#colophon" className="hover:underline" style={{ color: muted }}>
                § {SECTION_NUMERALS.contact} Contact
              </a>
            )}
          </nav>
          <span className="flex-shrink-0" style={{ color: muted }}>
            fol. 001
          </span>
        </div>
      </header>

      {/* Hero — a title page with folio number, drop-cap tagline, and marginal plate */}
      <section className="mx-auto max-w-[1400px] px-5 pb-16 pt-14 sm:px-10 sm:pt-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Left margin — meta */}
          <aside className="order-2 md:order-1 md:col-span-3">
            <div
              className="border-t pt-4 font-mono text-[10px] uppercase tracking-[0.28em]"
              style={{ borderColor: hairline, color: muted }}
            >
              <div className="flex justify-between">
                <span>Folio</span>
                <span>i</span>
              </div>
              <div className="mt-6 space-y-3">
                <div>
                  <div style={{ color: muted }}>Role</div>
                  <div className="mt-1 text-xs tracking-[0.18em]" style={{ color: surface.ink }}>
                    {site.role}
                  </div>
                </div>
                {site.medium && (
                  <div>
                    <div style={{ color: muted }}>Medium</div>
                    <div className="mt-1 text-xs tracking-[0.18em]" style={{ color: surface.ink }}>
                      {site.medium}
                    </div>
                  </div>
                )}
                {site.location && (
                  <div>
                    <div style={{ color: muted }}>Locus</div>
                    <div className="mt-1 text-xs tracking-[0.18em]" style={{ color: surface.ink }}>
                      {site.location}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ color: muted }}>Handle</div>
                  <div className="mt-1 text-xs tracking-[0.18em]" style={{ color: accent }}>
                    @{site.handle}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Center — title */}
          <div className="order-1 md:order-2 md:col-span-6">
            <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.35em]" style={{ color: accent }}>
              — A Monograph —
            </p>
            <h1
              className="text-[13vw] leading-[0.92] tracking-tight sm:text-[8vw] md:text-[6.5rem] lg:text-[7.5rem]"
              style={{ fontFamily: headingFont }}
            >
              <EditableText
                field="display_name"
                value={displayName}
                placeholder="Your name"
                as="span"
                className="italic"
              />
            </h1>
            {site.tagline && (
              <p
                className="mt-8 max-w-xl border-l-2 pl-5 text-lg italic leading-relaxed sm:text-xl first-letter:float-left first-letter:mr-1 first-letter:text-6xl first-letter:font-bold first-letter:not-italic first-letter:leading-[0.8]"
                style={{ borderColor: accent, color: surface.ink, fontFamily: headingFont }}
              >
                <EditableText field="tagline" value={site.tagline} placeholder="Your tagline…" as="span" />
              </p>
            )}

            {site.cta && (
              <div className="mt-10">
                <EditableCta cta={site.cta}>
                  <a
                    href={site.cta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex items-baseline gap-3 border-b pb-1 font-mono text-sm uppercase tracking-[0.24em] transition"
                    style={{ borderColor: accent, color: surface.ink }}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: accent }}
                      aria-hidden="true"
                    />
                    {site.cta.label}
                    <span
                      className="transition group-hover:translate-x-1"
                      style={{ color: accent }}
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </a>
                </EditableCta>
              </div>
            )}
          </div>

          {/* Right — plate / portrait */}
          <aside className="order-3 md:col-span-3">
            {site.hero_image_url ? (
              <EditableImage field="hero">
                <figure className="relative">
                  <div className="relative aspect-[3/4] w-full">
                    <Image
                      src={site.hero_image_url}
                      alt={`Portrait of ${displayName}`}
                      fill
                      className="object-cover grayscale"
                      style={{ filter: 'grayscale(1) contrast(1.05)' }}
                      unoptimized
                      priority
                    />
                  </div>
                  <figcaption
                    className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.24em]"
                    style={{ color: muted }}
                  >
                    <span>Pl. I</span>
                    <span>{displayName}</span>
                  </figcaption>
                  <span
                    className="absolute -top-2 -left-2 h-6 w-6 border-t-2 border-l-2"
                    style={{ borderColor: accent }}
                    aria-hidden="true"
                  />
                </figure>
              </EditableImage>
            ) : site.picture_url ? (
              <figure className="relative">
                <div className="relative aspect-[3/4] w-full">
                  <Image
                    src={site.picture_url}
                    alt={`Portrait of ${displayName}`}
                    fill
                    className="object-cover grayscale"
                    style={{ filter: 'grayscale(1) contrast(1.05)' }}
                    unoptimized
                  />
                </div>
                <figcaption
                  className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.24em]"
                  style={{ color: muted }}
                >
                  <span>Pl. I</span>
                  <span>{displayName}</span>
                </figcaption>
                <span
                  className="absolute -top-2 -left-2 h-6 w-6 border-t-2 border-l-2"
                  style={{ borderColor: accent }}
                  aria-hidden="true"
                />
              </figure>
            ) : null}
          </aside>
        </div>
      </section>

      <OrderedSections
        order={site.section_order}
        sections={site.sections}
        accentColor={accent}
        slots={{
          /* Bio — annotated body copy with margin note */
          bio: showBio ? (
            <Section id="bio" numeral={SECTION_NUMERALS.bio} title="On the Practice" ink={surface.ink} accent={accent} muted={muted} hairline={hairline}>
              <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
                <aside className="md:col-span-3" style={{ color: muted }}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em]">Marginal Note</p>
                  <p className="mt-3 text-sm italic leading-relaxed">
                    {site.medium
                      ? `Working principally in ${site.medium.toLowerCase()}.`
                      : 'A body of work assembled across seasons.'}
                    {site.location && ` Based in ${site.location}.`}
                  </p>
                </aside>
                <div className="md:col-span-9">
                  <p
                    className="text-lg leading-[1.75] sm:text-xl sm:leading-[1.7] first-letter:float-left first-letter:mr-2 first-letter:text-7xl first-letter:font-semibold first-letter:leading-[0.85]"
                    style={{ color: surface.ink, fontFamily: headingFont }}
                  >
                    <EditableText field="bio" value={site.bio} placeholder="Write a short bio…" as="span" />
                  </p>
                </div>
              </div>
            </Section>
          ) : undefined,

          /* Artworks — plates with footnote-style numbering */
          artworks: showArtworks ? (
            <Section id="plates" numeral={SECTION_NUMERALS.artworks} title="Plates & Works" ink={surface.ink} accent={accent} muted={muted} hairline={hairline}>
              <ol className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {site.artworks.map((w, i) => {
                  const num = String(i + 1).padStart(2, '0');
                  const isSold = !!w.sold_at;
                  const showPrice = !isSold && w.for_sale && typeof w.sale_price === 'number';
                  return (
                    <li key={w.id} className="group">
                      <SiteArtworkLink artwork={w} className="block">
                        <figure>
                          <div className="relative overflow-hidden">
                            {w.image_url ? (
                              <div className="relative aspect-[4/5] w-full">
                                <Image
                                  src={w.image_url}
                                  alt={`${w.title}${w.artist_name ? ` by ${w.artist_name}` : ''}, ${yearOf(w.created_at)}`}
                                  fill
                                  className="object-cover transition duration-700 group-hover:scale-[1.02]"
                                  unoptimized
                                  loading="lazy"
                                  sizes="(max-width: 768px) 100vw, 33vw"
                                />
                              </div>
                            ) : (
                              <div
                                className="flex aspect-[4/5] w-full items-center justify-center text-xs"
                                style={{ backgroundColor: `${surface.ink}0d`, color: muted }}
                              >
                                No image
                              </div>
                            )}
                            <span
                              className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center text-[10px] font-medium tracking-widest"
                              style={{ backgroundColor: surface.bg, color: accent, border: `1px solid ${accent}` }}
                              aria-hidden="true"
                            >
                              {num}
                            </span>
                            {isSold && (
                              <span
                                className="absolute top-3 right-3 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.24em]"
                                style={{ backgroundColor: surface.ink, color: surface.bg }}
                              >
                                Sold
                              </span>
                            )}
                          </div>
                          <figcaption className="mt-4">
                            <div className="flex items-baseline justify-between gap-3 border-b pb-2" style={{ borderColor: hairline }}>
                              <div className="min-w-0">
                                <p className="truncate text-base italic" style={{ color: surface.ink }}>
                                  {w.title}
                                </p>
                                {w.artist_name && (
                                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: muted }}>
                                    {w.artist_name}
                                  </p>
                                )}
                              </div>
                              <span className="shrink-0 font-mono text-[11px] tracking-[0.2em] tabular-nums" style={{ color: muted }}>
                                {yearOf(w.created_at)}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: muted }}>
                              <span>
                                Cert. № <span style={{ color: accent }}>{w.certificate_number}</span>
                              </span>
                              {showPrice && <span style={{ color: surface.ink }}>{fmtPrice(w.sale_price, w.sale_currency)}</span>}
                            </div>
                          </figcaption>
                        </figure>
                      </SiteArtworkLink>
                    </li>
                  );
                })}
              </ol>
            </Section>
          ) : undefined,

          /* Exhibitions — index-card list with dotted leaders */
          exhibitions: showExhibitions ? (
            <Section id="record" numeral={SECTION_NUMERALS.exhibitions} title="Exhibition Record" ink={surface.ink} accent={accent} muted={muted} hairline={hairline}>
              <ul className="divide-y" style={{ borderColor: hairline }}>
                {site.exhibitions.map((ex) => (
                  <li key={ex.id} className="border-t py-5" style={{ borderColor: hairline }}>
                    <Link
                      href={`/exhibitions/${ex.id}`}
                      className="grid grid-cols-12 items-baseline gap-4 transition-opacity hover:opacity-70"
                    >
                      <span className="col-span-3 font-mono text-[11px] uppercase tracking-[0.24em] tabular-nums sm:col-span-2" style={{ color: accent }}>
                        {yearOf(ex.start_date)}
                      </span>
                      <p className="col-span-9 text-lg italic leading-snug sm:col-span-7" style={{ color: surface.ink }}>
                        {ex.title}
                        {ex.location && (
                          <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.24em] not-italic" style={{ color: muted }}>
                            {ex.location}
                          </span>
                        )}
                      </p>
                      <span className="col-span-12 text-right font-mono text-[11px] tracking-[0.18em] sm:col-span-3" style={{ color: muted }}>
                        {fmtExhibitionRange(ex.start_date, ex.end_date)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : undefined,

          /* Press — footnoted citations */
          press: showPress ? (
            <Section id="citations" numeral={SECTION_NUMERALS.press} title="Selected Citations" ink={surface.ink} accent={accent} muted={muted} hairline={hairline}>
              <ol className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {site.press.map((p, i) => (
                  <li key={`${p.url}-${i}`} className="flex gap-4 border-t pt-5" style={{ borderColor: hairline }}>
                    <sup className="mt-1 shrink-0 font-mono text-[11px] tabular-nums" style={{ color: accent }}>
                      [{i + 1}]
                    </sup>
                    <a href={p.url} target="_blank" rel="noreferrer" className="group block">
                      <p className="text-base italic leading-snug transition group-hover:underline" style={{ color: surface.ink }}>
                        &ldquo;{p.title}&rdquo;
                      </p>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: muted }}>
                        {p.publication_name && <span>{p.publication_name}</span>}
                        {p.publication_name && p.date && <span style={{ color: `${surface.ink}44` }}> · </span>}
                        {p.date && <span>{p.date}</span>}
                      </p>
                    </a>
                  </li>
                ))}
              </ol>
            </Section>
          ) : undefined,

          /* Contact — colophon */
          contact: showContact ? (
            <Section id="colophon" numeral={SECTION_NUMERALS.contact} title="Colophon & Correspondence" ink={surface.ink} accent={accent} muted={muted} hairline={hairline}>
              <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
                <div className="md:col-span-7">
                  <p className="text-2xl italic leading-snug sm:text-3xl" style={{ color: surface.ink, fontFamily: headingFont }}>
                    For studio visits, acquisitions, or press —
                    <br />
                    <span style={{ color: accent }}>write directly.</span>
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 text-sm">
                    {site.website && (
                      <a
                        href={site.website}
                        target="_blank"
                        rel="noreferrer"
                        className="border-b pb-0.5 font-mono tracking-wide hover:opacity-70"
                        style={{ borderColor: accent, color: surface.ink }}
                      >
                        {site.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    <span className="font-mono" style={{ color: muted }}>
                      @{site.handle}
                    </span>
                    {site.cta && (
                      <EditableCta cta={site.cta}>
                        <a
                          href={site.cta.url}
                          target="_blank"
                          rel="noreferrer"
                          className="border-b pb-0.5 font-mono tracking-wide hover:opacity-70"
                          style={{ borderColor: accent, color: surface.ink }}
                        >
                          {site.cta.label} →
                        </a>
                      </EditableCta>
                    )}
                  </div>
                  {!site.website && !site.cta && (
                    <div className="mt-6">
                      <SiteContactBlock name={site.name} website={site.website} location={site.location} medium={site.medium} />
                    </div>
                  )}
                </div>
                <aside className="md:col-span-5" style={{ color: muted }}>
                  <div className="border-t pt-4 font-mono text-[10px] uppercase tracking-[0.28em]" style={{ borderColor: hairline }}>
                    <p>Set in a transitional serif.</p>
                    <p className="mt-2">
                      Composed on provenance.guru for {displayName}, {new Date().getFullYear()}.
                    </p>
                    {!site.is_white_label && (
                      <p className="mt-6" style={{ color: `${surface.ink}66` }}>
                        Published with <span style={{ color: accent }}>provenance.guru</span>
                      </p>
                    )}
                  </div>
                </aside>
              </div>
            </Section>
          ) : undefined,
        }}
      />

      {/* Footer folio */}
      <footer className="mt-10 border-t" style={{ borderColor: hairline }}>
        <div
          className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-6 font-mono text-[10px] uppercase tracking-[0.28em] sm:px-10"
          style={{ color: muted }}
        >
          <span>— fin —</span>
          <span>Marginalia</span>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section wrapper                                                     */
/* ------------------------------------------------------------------ */

function Section({
  id,
  numeral,
  title,
  children,
  ink,
  accent,
  muted,
  hairline,
}: {
  id: string;
  numeral: string;
  title: string;
  children: ReactNode;
  ink: string;
  accent: string;
  muted: string;
  hairline: string;
}) {
  return (
    <section id={id} className="mx-auto max-w-[1400px] scroll-mt-20 px-5 py-16 sm:px-10 sm:py-24">
      <header className="mb-10 flex items-end justify-between gap-6 border-b pb-4" style={{ borderColor: hairline }}>
        <div className="flex items-baseline gap-5">
          <span className="text-xs uppercase tracking-[0.32em]" style={{ color: accent }}>
            §&nbsp;{numeral}
          </span>
          <h2 className="text-2xl italic leading-none sm:text-4xl" style={{ color: ink }}>
            {title}
          </h2>
        </div>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] sm:inline" style={{ color: muted }}>
          {id}
        </span>
      </header>
      {children}
    </section>
  );
}
