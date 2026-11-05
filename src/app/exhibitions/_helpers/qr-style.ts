import { QR_LOGO_DATA_URI, QR_LOGO_SCALE } from './qr-logo';

/**
 * Exhibition QR code styles. A style is applied by composing an SVG around the
 * plain code that qrcode.react draws (rendered with level "H", no margin,
 * black on white): recolouring, a glow, frames, a centre image or wordmark.
 * The same SVG string feeds the dialog preview, the SVG/PNG downloads and the
 * print pages, so every output matches.
 */

export const QR_STYLES = [
  { id: 'plain', label: 'No image', hint: 'Classic black and white' },
  { id: 'photon', label: 'Photon Labs', hint: 'Stacked-frames image in the centre' },
  { id: 'wordmark', label: 'Provenance', hint: '“provenance” lettered across the centre' },
  { id: 'neon', label: 'Neon', hint: 'Cyan glow on dark, framed' },
  { id: 'custom', label: 'Your image', hint: 'Upload a logo or photo' },
] as const;

export type QrStyleId = (typeof QR_STYLES)[number]['id'];

export type QrStyleSettings = {
  style: QrStyleId;
  /** Small PNG/JPEG data URI, only used by the "custom" style. */
  customImage: string | null;
};

export const DEFAULT_QR_STYLE: QrStyleSettings = { style: 'plain', customImage: null };

/** Upper bound for a stored custom image (the dialog shrinks uploads well below this). */
export const MAX_CUSTOM_IMAGE_CHARS = 80_000;

const STYLE_IDS = new Set<string>(QR_STYLES.map((s) => s.id));

export function isQrStyleId(value: unknown): value is QrStyleId {
  return typeof value === 'string' && STYLE_IDS.has(value);
}

export function isQrImageDataUri(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_CUSTOM_IMAGE_CHARS &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)
  );
}

/** Reads the saved style from `exhibitions.metadata.qr`, falling back to plain. */
export function readQrStyle(metadata: unknown): QrStyleSettings {
  const qr =
    metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>).qr
      : undefined;
  if (!qr || typeof qr !== 'object') return DEFAULT_QR_STYLE;
  const { style, customImage } = qr as Record<string, unknown>;
  const image = isQrImageDataUri(customImage) ? customImage : null;
  if (!isQrStyleId(style)) return { ...DEFAULT_QR_STYLE, customImage: image };
  // A custom style without an image falls back to plain.
  if (style === 'custom' && !image) return { style: 'plain', customImage: null };
  return { style, customImage: image };
}

/** The image placed in the centre for this style, if any. */
export function qrCentreImage(settings: QrStyleSettings): string | null {
  if (settings.style === 'photon') return QR_LOGO_DATA_URI;
  if (settings.style === 'custom') return settings.customImage;
  return null;
}

// ── Composition ───────────────────────────────────────────────────────────────

const NEON = { bg: '#242400', fg: '#8cf0e6', glow: '#3d5cff' };
const WORDMARK_INK = '#4b3224';

/** Parses qrcode.react's SVG: module count and the drawing inside <svg>. */
function parseBaseSvg(svg: string): { n: number; inner: string } | null {
  const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  const open = svg.indexOf('>');
  const close = svg.lastIndexOf('</svg>');
  if (!viewBox || open < 0 || close < 0) return null;
  const inner = svg
    .slice(open + 1, close)
    .replace(/<title>[\s\S]*?<\/title>/g, '');
  return { n: Number(viewBox[1]), inner };
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export type CentreImagePlacement = { href: string; x: number; y: number; size: number; total: number };

/**
 * Where the centre image goes, in the composed SVG's units (out of `total`).
 * The PNG export draws it onto the canvas separately (see omitImages).
 */
export function centreImagePlacement(
  baseSvg: string,
  settings: QrStyleSettings,
): CentreImagePlacement | null {
  const href = qrCentreImage(settings);
  const parsed = parseBaseSvg(baseSvg);
  if (!href || !parsed) return null;
  const pad = paddingFor(settings.style);
  const total = parsed.n + pad * 2;
  const size = parsed.n * QR_LOGO_SCALE;
  return { href, x: (total - size) / 2, y: (total - size) / 2, size, total };
}

function paddingFor(style: QrStyleId): number {
  // Neon is light-on-dark: 4 modules of dark quiet zone, then the frames.
  return style === 'neon' ? 7.5 : 2;
}

/**
 * The finished QR SVG for a style. `baseSvg` must be a qrcode.react SVG drawn
 * with level "H", marginSize 0, fgColor #000000 and bgColor #FFFFFF.
 * `omitImages` leaves out the centre <image> (its white backing stays) so a
 * canvas can draw the image itself without being tainted.
 */
export function composeStyledQr(
  baseSvg: string,
  settings: QrStyleSettings,
  options: { pixelSize?: number; omitImages?: boolean; title?: string } = {},
): string {
  const parsed = parseBaseSvg(baseSvg);
  if (!parsed) return baseSvg;
  const { n } = parsed;
  const pad = paddingFor(settings.style);
  const total = n + pad * 2;
  const c = total / 2;

  let inner = parsed.inner;
  let background = '#FFFFFF';
  const defs: string[] = [];
  const before: string[] = [];
  const after: string[] = [];

  if (settings.style === 'neon') {
    background = NEON.bg;
    inner = inner
      .replace(/fill="#FFFFFF"/gi, `fill="${NEON.bg}"`)
      .replace(/fill="#000000"/gi, `fill="${NEON.fg}" filter="url(#pv-qr-glow)"`);
    defs.push(
      `<filter id="pv-qr-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.3" result="b"/><feFlood flood-color="${NEON.glow}" flood-opacity="0.9"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    );
    // Stacked frames, echoing the Photon Labs image, outside the quiet zone.
    [1.1, 2.0, 2.9].forEach((inset, i) => {
      const side = round(total - inset * 2);
      before.push(
        `<rect x="${inset}" y="${inset}" width="${side}" height="${side}" rx="0.6" fill="none" stroke="${NEON.fg}" stroke-opacity="${round(1 - i * 0.18)}" stroke-width="0.3" filter="url(#pv-qr-glow)"/>`,
      );
    });
  }

  const image = qrCentreImage(settings);
  if (image) {
    const size = n * QR_LOGO_SCALE;
    const border = Math.max(0.6, n * 0.015);
    const back = size + border * 2;
    after.push(
      `<rect x="${round(c - back / 2)}" y="${round(c - back / 2)}" width="${round(back)}" height="${round(back)}" rx="${round(border)}" fill="#FFFFFF"/>`,
    );
    if (!options.omitImages) {
      after.push(
        `<image href="${image}" x="${round(c - size / 2)}" y="${round(c - size / 2)}" width="${round(size)}" height="${round(size)}" preserveAspectRatio="xMidYMid slice"/>`,
      );
    }
  }

  if (settings.style === 'wordmark') {
    const w = n * 0.58;
    const h = n * 0.15;
    after.push(
      `<rect x="${round(c - w / 2)}" y="${round(c - h / 2)}" width="${round(w)}" height="${round(h)}" rx="${round(h * 0.22)}" fill="#FFFFFF"/>`,
      `<text x="${round(c)}" y="${round(c)}" text-anchor="middle" dominant-baseline="central" font-family="'Cormorant Garamond', Cormorant, Georgia, 'Times New Roman', serif" font-weight="500" font-size="${round(h * 0.6)}" fill="${WORDMARK_INK}" textLength="${round(w * 0.84)}" lengthAdjust="spacingAndGlyphs">provenance</text>`,
    );
  }

  const size = options.pixelSize ? ` width="${options.pixelSize}" height="${options.pixelSize}"` : '';
  const title = options.title ? `<title>${options.title.replace(/[<&>]/g, '')}</title>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(total)} ${round(total)}"${size} role="img">` +
    title +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    `<rect width="${round(total)}" height="${round(total)}" fill="${background}"/>` +
    before.join('') +
    `<g transform="translate(${pad} ${pad})">${inner}</g>` +
    after.join('') +
    `</svg>`
  );
}
