/**
 * Cabinet Template
 * Curatorial catalog. Sticky left-hand table-of-contents rail with dotted
 * leaders, roman-numeral "plates" for artworks, generous serif display type
 * mixed with monospace metadata, and hairline rules.
 * Best fit for estates and artists with a catalogued body of work.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { SiteData } from '../types';
import { resolveAccent, resolveSurface, isDarkSurface } from './palette';
import { EditableText } from '../_components/editable-text';
import { EditableImage } from '../_components/editable-image';
import { EditableCta } from '../_components/editable-cta';

/* ── local helpers (alpha tints not covered by palette.ts) ── */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().replace('#', '');
  if (m.length !== 3 && m.length !== 6) return null;
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const num = parseInt(full, 16);
  if (isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function isDark(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const l = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return l < 0.55;
}

/* ── Roman numeral helper ── */

const ROMAN_TABLE: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'],  [90, 'XC'],  [50, 'L'],  [40, 'XL'],
  [10, 'X'],   [9, 'IX'],   [5, 'V'],   [4, 'IV'],
  [1, 'I'],
];

function toRoman(n: number): string {
  if (n <= 0) return '';
  let out = '';
  let rem = n;
  for (const [v, s] of ROMAN_TABLE) {
    while (rem >= v) { out += s; rem -= v; }
  }
  return out;
}

function year(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : String(d.getFullYear());
}

function fmtRange(start: string, end: string | null): string {
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };
  const sStr = isNaN(s.getTime()) ? start : s.toLocaleDateString(undefined, opts);
  if (!e) return sStr;
  const eStr = isNaN(e.getTime()) ? end! : e.toLocaleDateString(undefined, opts);
  return `${sStr} — ${eStr}`;
}

function fmtPrice(amount: number, currency: string | null | undefined): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency ?? 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency ?? '$'} ${amount.toLocaleString()}`;
  }
}

/* ── component ── */

export function CabinetTemplate({ site }: { site: SiteData }) {
  const accentHex = resolveAccent(site.theme.accent);
  const surface = resolveSurface(site.surface_color, site.theme.text_color);
  const dark = isDarkSurface(site.surface_color);

  const ink = surface.ink;
  const bg = surface.bg;
  const muted = withAlpha(ink, dark ? 0.6 : 0.6);
  const hairline = withAlpha(ink, dark ? 0.25 : 0.15);

  const displayName = site.display_name ?? site.name;

  const showBio = site.sections.bio && !!site.bio;
  const showArtworks = site.sections.artworks && site.artworks.length > 0;
  const showExhibitions = site.sections.exhibitions && site.exhibitions.length > 0;
  const showPress = site.sections.press && site.press.length > 0;
  const showContact =
    site.sections.contact && (!!site.website || !!site.cta || !!site.location);

  type TocItem = { id: string; label: string; count?: string };
  const toc: TocItem[] = [];
  if (showBio) toc.push({ id: 'colophon', label: 'Colophon' });
  if (showArtworks) toc.push({ id: 'plates', label: 'Plates', count: String(site.artworks.length).padStart(2, '0') });
  if (showExhibitions) toc.push({ id: 'exhibitions', label: 'Exhibitions', count: String(site.exhibitions.length).padStart(2, '0') });
  if (showPress) toc.push({ id: 'press', label: 'Press', count: String(site.press.length).padStart(2, '0') });
  if (showContact) toc.push({ id: 'correspondence', label: 'Correspondence' });

  const roleLabel =
    site.role === 'gallery' ? 'Gallery' :
    site.role === 'collector' ? 'Collection' :
    'Studio';

  return (
    <div
      style={{
        backgroundColor: bg,
        color: ink,
        fontFamily: 'var(--site-font-body, "Cormorant Garamond", "EB Garamond", Georgia, "Times New Roman", serif)',
      }}
      className="min-h-screen w-full antialiased"
    >
      {/* ── Top ribbon ── */}
      <header
        className="sticky top-0 z-20 w-full backdrop-blur"
        style={{ backgroundColor: withAlpha(bg, 0.88), borderBottom: `1px solid ${hairline}` }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3 md:px-10">
          <a href="#top" className="flex items-center gap-3" style={{ color: ink }}>
            {site.logo_image_url ? (
              <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ border: `1px solid ${hairline}` }}>
                <Image
                  src={site.logo_image_url}
                  alt={`${displayName} logo`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <span
                className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full font-mono text-[10px] uppercase"
                style={{ border: `1px solid ${ink}`, color: ink }}
              >
                {displayName.slice(0, 1)}
              </span>
            )}
            <span className="font-mono text-[11px] uppercase tracking-[0.24em]" style={{ color: muted }}>
              {roleLabel} · @{site.handle}
            </span>
          </a>

          {site.cta && (
            <a
              href={site.cta.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-opacity hover:opacity-80"
              style={{ backgroundColor: accentHex, color: isDark(accentHex) ? '#FFFFFF' : '#111111' }}
            >
              {site.cta.label}
              <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1400px] px-5 pb-24 pt-10 md:px-10 md:pt-16">

        {/* ── Frontispiece / Hero ── */}
        <section
          className="grid grid-cols-1 gap-10 pb-16 md:grid-cols-12 md:gap-8 md:pb-24"
          aria-labelledby="frontispiece"
        >
          <div className="md:col-span-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em]" style={{ color: muted }}>
              Cabinet № {new Date().getFullYear()} · Vol. I
            </div>

            <h1
              id="frontispiece"
              className="mt-6 font-normal leading-[0.95] tracking-tight"
              style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)', letterSpacing: '-0.02em' }}
            >
              <EditableText field="display_name" value={displayName} placeholder="Your name" as="span" />
              <span style={{ color: accentHex }}>.</span>
            </h1>

            <p className="mt-6 max-w-lg italic leading-snug" style={{ fontSize: 'clamp(1.15rem, 1.6vw, 1.5rem)', color: withAlpha(ink, 0.82) }}>
              "<EditableText field="tagline" value={site.tagline} placeholder="Your tagline…" as="span" />"
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-y-4 font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: ink }}>
              {site.location && (
                <>
                  <dt style={{ color: muted }}>Located</dt>
                  <dd>{site.location}</dd>
                </>
              )}
              {site.medium && (
                <>
                  <dt style={{ color: muted }}>Medium</dt>
                  <dd>{site.medium}</dd>
                </>
              )}
              <dt style={{ color: muted }}>Role</dt>
              <dd>{roleLabel}</dd>
              {site.website && (
                <>
                  <dt style={{ color: muted }}>Web</dt>
                  <dd className="truncate">
                    <a
                      href={site.website}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-dotted underline-offset-4"
                      style={{ color: ink }}
                    >
                      {site.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </div>

          {/* Hero plate */}
          <figure className="md:col-span-7">
            <div
              className="relative overflow-hidden"
              style={{ border: `1px solid ${hairline}`, padding: '14px', backgroundColor: withAlpha(ink, 0.02) }}
            >
              <div
                className="absolute inset-2 pointer-events-none"
                style={{ border: `1px solid ${hairline}` }}
                aria-hidden
              />
              {site.hero_image_url ? (
                <EditableImage field="hero">
                  <div className="relative aspect-[4/5] w-full md:aspect-[5/6]">
                    <Image
                      src={site.hero_image_url}
                      alt={`${displayName} — frontispiece`}
                      fill
                      className="object-cover"
                      unoptimized
                      priority
                    />
                  </div>
                </EditableImage>
              ) : site.picture_url ? (
                <div className="relative aspect-[4/5] w-full md:aspect-[5/6]">
                  <Image
                    src={site.picture_url}
                    alt={displayName}
                    fill
                    className="object-cover"
                    unoptimized
                    priority
                  />
                </div>
              ) : (
                <div
                  className="relative flex aspect-[4/5] w-full items-center justify-center md:aspect-[5/6]"
                  style={{ backgroundColor: withAlpha(ink, 0.05) }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: muted }}>
                    Plate — no image
                  </span>
                </div>
              )}
            </div>
            <figcaption
              className="mt-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.24em]"
              style={{ color: muted }}
            >
              <span>Frontispiece</span>
              <span>Fig. 00 · Recto</span>
            </figcaption>
          </figure>
        </section>

        {/* ── Body: TOC rail + content ── */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-10">

          {/* Table of contents */}
          {toc.length > 0 && (
            <aside className="md:col-span-3">
              <div className="md:sticky md:top-24">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: muted }}>
                  Contents
                </div>
                <ol className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: hairline }}>
                  {toc.map((item, i) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className="group flex items-baseline gap-2 py-1" style={{ color: ink }}>
                        <span className="font-mono text-[10px] tabular-nums" style={{ color: muted }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[15px] transition-colors group-hover:italic" style={{ color: ink }}>
                          {item.label}
                        </span>
                        <span
                          aria-hidden
                          className="mx-1 flex-1 translate-y-[-3px] border-b border-dotted"
                          style={{ borderColor: hairline }}
                        />
                        {item.count && (
                          <span className="font-mono text-[10px] tabular-nums" style={{ color: muted }}>
                            {item.count}
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          )}

          <div className={toc.length > 0 ? 'md:col-span-9' : 'md:col-span-12'}>

            {/* ── Colophon (bio) ── */}
            {showBio && (
              <SectionHeader id="colophon" index="I" label="Colophon" accent={accentHex} muted={muted} hairline={hairline} />
            )}
            {showBio && (
              <section className="mb-24">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
                  <div className="md:col-span-8 md:col-start-1" style={{ fontSize: 'clamp(1.15rem, 1.5vw, 1.4rem)', lineHeight: 1.55, color: withAlpha(ink, 0.9) }}>
                    <span className="float-left mr-3 mt-1 font-normal leading-[0.8]" style={{ fontSize: '4.5rem', color: accentHex, fontFamily: 'inherit' }} aria-hidden>
                      {(site.bio ?? '')[0]}
                    </span>
                    <EditableText field="bio" value={site.bio} placeholder="Write a short bio…" as="span" />
                  </div>
                </div>
              </section>
            )}

            {/* ── Plates (artworks) ── */}
            {showArtworks && (
              <SectionHeader
                id="plates"
                index="II"
                label="Plates"
                sub={`${site.artworks.length} works catalogued`}
                accent={accentHex}
                muted={muted}
                hairline={hairline}
              />
            )}
            {showArtworks && (
              <section className="mb-24 space-y-16">
                {site.artworks.map((art, i) => {
                  const flip = i % 2 === 1;
                  return (
                    <article
                      key={art.id}
                      className="grid grid-cols-1 items-start gap-6 md:grid-cols-12 md:gap-8"
                    >
                      <figure className={`md:col-span-7 ${flip ? 'md:order-2 md:col-start-6' : ''}`}>
                        <Link href={`/works/${art.id}`} className="block group">
                          <div
                            style={{
                              border: `1px solid ${hairline}`,
                              padding: '10px',
                              backgroundColor: withAlpha(ink, 0.02),
                            }}
                          >
                            {art.image_url ? (
                              <div className="relative aspect-[4/5] w-full overflow-hidden">
                                <Image
                                  src={art.image_url}
                                  alt={`${art.title}${art.artist_name ? ` by ${art.artist_name}` : ''}`}
                                  fill
                                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                                  unoptimized
                                  loading="lazy"
                                  sizes="(max-width: 768px) 100vw, 58vw"
                                />
                              </div>
                            ) : (
                              <div
                                className="flex aspect-[4/5] w-full items-center justify-center"
                                style={{ backgroundColor: withAlpha(ink, 0.05) }}
                              >
                                <span className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: muted }}>
                                  No plate
                                </span>
                              </div>
                            )}
                          </div>
                        </Link>
                      </figure>

                      <div className={`md:col-span-5 ${flip ? 'md:order-1 md:col-start-1' : ''}`}>
                        <div
                          className="flex items-baseline gap-3 font-mono text-[10px] uppercase tracking-[0.28em]"
                          style={{ color: muted }}
                        >
                          <span style={{ color: accentHex }}>Pl. {toRoman(i + 1)}</span>
                          <span aria-hidden className="flex-1 border-b border-dotted" style={{ borderColor: hairline }} />
                          <span>{year(art.created_at)}</span>
                        </div>

                        <Link href={`/works/${art.id}`} className="block group">
                          <h3
                            className="mt-3 font-normal leading-tight tracking-tight transition-opacity group-hover:opacity-70"
                            style={{ fontSize: 'clamp(1.6rem, 2.4vw, 2.4rem)', letterSpacing: '-0.01em' }}
                          >
                            {art.title}
                          </h3>
                        </Link>

                        {art.artist_name && (
                          <p className="mt-1 italic" style={{ color: withAlpha(ink, 0.75) }}>
                            by {art.artist_name}
                          </p>
                        )}

                        <dl
                          className="mt-6 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 border-t pt-4 font-mono text-[11px] uppercase tracking-[0.16em]"
                          style={{ borderColor: hairline, color: ink }}
                        >
                          <dt style={{ color: muted }}>Cert.</dt>
                          <dd className="tabular-nums">{art.certificate_number}</dd>
                          <dt style={{ color: muted }}>Year</dt>
                          <dd className="tabular-nums">{year(art.created_at)}</dd>
                          <dt style={{ color: muted }}>Status</dt>
                          <dd>
                            {art.sold_at ? (
                              <span
                                className="inline-block px-2 py-0.5"
                                style={{ border: `1px solid ${ink}`, color: ink }}
                              >
                                Sold
                              </span>
                            ) : art.for_sale && art.sale_price != null ? (
                              <span style={{ color: accentHex }}>
                                {fmtPrice(art.sale_price, art.sale_currency)}
                              </span>
                            ) : (
                              <span style={{ color: muted }}>Not for sale</span>
                            )}
                          </dd>
                        </dl>

                        {!art.sold_at && (art.for_sale || art.sale_price) && (
                          <div className="mt-6">
                            <Link
                              href={`/works/${art.id}`}
                              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] transition-opacity hover:opacity-70"
                              style={{ color: accentHex }}
                            >
                              View work <span aria-hidden>→</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            )}

            {/* ── Exhibitions ── */}
            {showExhibitions && (
              <SectionHeader id="exhibitions" index="III" label="Exhibitions" accent={accentHex} muted={muted} hairline={hairline} />
            )}
            {showExhibitions && (
              <section className="mb-24">
                <ul className="border-t" style={{ borderColor: hairline }}>
                  {site.exhibitions.map((ex) => (
                    <li
                      key={ex.id}
                      className="border-b"
                      style={{ borderColor: hairline }}
                    >
                      <Link
                        href={`/exhibitions/${ex.id}`}
                        className="group grid grid-cols-1 items-baseline gap-2 py-5 md:grid-cols-12 md:gap-6 transition-opacity hover:opacity-70"
                        style={{ color: ink }}
                      >
                        <span className="font-mono text-[11px] uppercase tracking-[0.2em] md:col-span-3" style={{ color: muted }}>
                          {fmtRange(ex.start_date, ex.end_date)}
                        </span>
                        <h4
                          className="md:col-span-6"
                          style={{ fontSize: 'clamp(1.15rem, 1.4vw, 1.35rem)', color: ink }}
                        >
                          {ex.title}
                        </h4>
                        {ex.location && (
                          <span className="italic md:col-span-3 md:text-right" style={{ color: withAlpha(ink, 0.7) }}>
                            {ex.location}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Press ── */}
            {showPress && (
              <SectionHeader id="press" index="IV" label="Press" accent={accentHex} muted={muted} hairline={hairline} />
            )}
            {showPress && (
              <section className="mb-24">
                <ul className="grid grid-cols-1 gap-px md:grid-cols-2">
                  {site.press.map((p, i) => (
                    <li
                      key={i}
                      className="p-5"
                      style={{
                        border: `1px solid ${hairline}`,
                        marginTop: '-1px',
                        marginLeft: i % 2 === 0 ? 0 : '-1px',
                      }}
                    >
                      <a href={p.url} target="_blank" rel="noreferrer" className="group block" style={{ color: ink }}>
                        <div
                          className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.24em]"
                          style={{ color: muted }}
                        >
                          <span>{p.publication_name ?? 'Press'}</span>
                          {p.date && <span>{year(p.date)}</span>}
                        </div>
                        <h5
                          className="mt-3 italic leading-snug transition-colors group-hover:underline"
                          style={{ fontSize: 'clamp(1.05rem, 1.3vw, 1.25rem)' }}
                        >
                          "{p.title}"
                        </h5>
                        <div
                          className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em]"
                          style={{ color: accentHex }}
                        >
                          Read <span aria-hidden>↗</span>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Correspondence (contact) ── */}
            {showContact && (
              <SectionHeader id="correspondence" index="V" label="Correspondence" accent={accentHex} muted={muted} hairline={hairline} />
            )}
            {showContact && (
              <section className="mb-8">
                <div
                  className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3 md:gap-8 md:p-10"
                  style={{ border: `1px solid ${hairline}` }}
                >
                  {site.location && (
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: muted }}>
                        Address
                      </div>
                      <div className="mt-2 text-lg">{site.location}</div>
                    </div>
                  )}
                  {site.website && (
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: muted }}>
                        Web
                      </div>
                      <a
                        href={site.website}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-lg underline decoration-dotted underline-offset-4"
                        style={{ color: ink }}
                      >
                        {site.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {site.cta && (
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: muted }}>
                        Enquire
                      </div>
                      <EditableCta cta={site.cta}>
                        <a
                          href={site.cta.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] transition-opacity hover:opacity-80"
                          style={{ backgroundColor: accentHex, color: isDark(accentHex) ? '#FFFFFF' : '#111111' }}
                        >
                          {site.cta.label} <span aria-hidden>↗</span>
                        </a>
                      </EditableCta>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t" style={{ borderColor: hairline, color: muted }}>
        <div className="mx-auto flex max-w-[1400px] items-center px-5 py-8 font-mono text-[10px] uppercase tracking-[0.28em] md:px-10">
          <span>© {new Date().getFullYear()} {displayName} — {roleLabel}</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Section header ── */

function SectionHeader({
  id,
  index,
  label,
  sub,
  accent,
  muted,
  hairline,
}: {
  id: string;
  index: string;
  label: string;
  sub?: string;
  accent: string;
  muted: string;
  hairline: string;
}) {
  return (
    <div
      id={id}
      className="mb-10 flex items-end justify-between gap-4 border-b pb-4 pt-2 scroll-mt-24"
      style={{ borderColor: hairline }}
    >
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: accent }}>
          § {index}
        </span>
        <h2
          className="font-normal tracking-tight"
          style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', letterSpacing: '-0.01em' }}
        >
          {label}
        </h2>
      </div>
      {sub && (
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] md:inline" style={{ color: muted }}>
          {sub}
        </span>
      )}
    </div>
  );
}
