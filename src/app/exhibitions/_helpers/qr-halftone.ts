/**
 * Art QR codes: a picture or words drawn by the code's own dots, with nothing
 * laid on top.
 *
 * Every module is split into 3×3 sub-dots. The centre sub-dot keeps the
 * module's real value (where scanners sample) and at least MIN_MATCH of the
 * eight around it agree with it, so the code reads like a plain one even from
 * a distance. The remaining sub-dots follow the artwork's light and dark
 * (dithered), and every sub-dot takes the artwork's colour, darkened or
 * lightened just enough to stay on the right side of what a scanner calls
 * "dark" and "light". Finder, timing, alignment, format and version patterns
 * stay solid.
 *
 * Artwork is stored as a palette of up to 16 colours and a ART_GRID × ART_GRID
 * grid of palette indices (4 bits each, base64): "rrggbb,rrggbb,…|<base64>".
 * It's made in the browser from an image or words (qr-art-client.ts) and saved
 * with the exhibition's QR style.
 */

export const ART_GRID = 160;
const GRID_BYTES = (ART_GRID * ART_GRID) / 2;
const GRID_CHARS = Math.ceil(GRID_BYTES / 3) * 4;
/** Sub-dots (of the 8 around the centre) that share the module's colour; 7 scans like a plain code. */
export const MIN_MATCH = 7;

export type Rgb = [number, number, number];
export type QrArt = { palette: Rgb[]; indices: Uint8Array };

const ART_PATTERN = new RegExp(
  `^[0-9a-f]{6}(,[0-9a-f]{6}){0,15}\\|[A-Za-z0-9+/]{${GRID_CHARS - 2}}[A-Za-z0-9+/=]{2}$`,
);

export function isArtGrid(value: unknown): value is string {
  return typeof value === 'string' && value.length < 200 + GRID_CHARS && ART_PATTERN.test(value);
}

const hex = (c: Rgb) => c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

/** Packs a palette and row-major ART_GRID² palette indices into the stored string. */
export function encodeArt(palette: Rgb[], indices: ArrayLike<number>): string {
  const bytes = new Uint8Array(GRID_BYTES);
  const top = Math.max(0, Math.min(15, palette.length - 1));
  const at = (i: number) => Math.min(top, Math.max(0, indices[i] ?? 0));
  for (let i = 0; i < GRID_BYTES; i++) bytes[i] = (at(i * 2) << 4) | at(i * 2 + 1);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `${palette.slice(0, 16).map(hex).join(',')}|${btoa(binary)}`;
}

export function decodeArt(value: string): QrArt {
  const [head = '', body = ''] = value.split('|');
  const palette = head.split(',').map((h) => [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16)) as Rgb);
  const binary = atob(body);
  const indices = new Uint8Array(ART_GRID * ART_GRID);
  const top = palette.length - 1;
  for (let i = 0; i < binary.length && i * 2 + 1 < indices.length; i++) {
    const byte = binary.charCodeAt(i);
    indices[i * 2] = Math.min(top, byte >> 4);
    indices[i * 2 + 1] = Math.min(top, byte & 15);
  }
  return { palette, indices };
}

/** Perceived lightness (0–1) the way scanners binarise: gamma-encoded luma. */
export function luma([r, g, b]: Rgb): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Tested with Apple Vision (the iPhone camera's reader) at 2–6 screen pixels
// per module: with MIN_MATCH 7 these read as well as a plain code.
const DARK_MAX = 0.3;
const LIGHT_MIN = 0.75;

/** The colour, darkened so it reads as a dark dot. Brighter colours go darker, keeping their hue. */
export function darkShade(c: Rgb): Rgb {
  const l = luma(c);
  const target = DARK_MAX * Math.min(1, 1.15 - l);
  const k = l > target ? target / l : 1;
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** The colour, lightened toward white so it reads as a light dot. */
export function lightShade(c: Rgb): Rgb {
  const l = luma(c);
  const t = l < LIGHT_MIN ? (LIGHT_MIN - l) / (1 - l) : 0;
  return [c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t];
}

/** Reads the module matrix out of qrcode.react's path ("M{x} {y}h{w}v1H{x}z" runs). */
export function parseModules(inner: string, n: number): boolean[][] {
  const dark = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const paths = [
    ...inner.matchAll(/<path[^>]*fill="#000000"[^>]*d="([^"]+)"|<path[^>]*d="([^"]+)"[^>]*fill="#000000"/gi),
  ];
  for (const p of paths) {
    const d = p[1] ?? p[2] ?? '';
    for (const m of d.matchAll(/M\s*(\d+)[\s,]+(\d+)\s*h(\d+)v(\d+)/g)) {
      const x0 = Number(m[1]);
      const y0 = Number(m[2]);
      const w = Number(m[3]);
      const h = Number(m[4]);
      for (let y = y0; y < Math.min(n, y0 + h); y++) {
        for (let x = x0; x < Math.min(n, x0 + w); x++) dark[y]![x] = true;
      }
    }
  }
  return dark;
}

/** Alignment-pattern centre coordinates for a QR version (same table as qrcodegen). */
export function alignmentPositions(version: number): number[] {
  if (version <= 1) return [];
  const size = version * 4 + 17;
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

/** Modules that must stay solid: finders + separators, timing, alignment, format and version info. */
export function functionModuleMask(n: number): boolean[][] {
  const mask = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const fill = (x0: number, y0: number, w: number, h: number) => {
    for (let y = Math.max(0, y0); y < Math.min(n, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(n, x0 + w); x++) mask[y]![x] = true;
    }
  };
  // Finders with separators, plus the format info strips beside them.
  fill(0, 0, 9, 9);
  fill(n - 8, 0, 8, 9);
  fill(0, n - 8, 9, 8);
  // Timing patterns.
  fill(0, 6, n, 1);
  fill(6, 0, 1, n);
  const version = (n - 17) / 4;
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  positions.forEach((cy, i) => {
    positions.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      fill(cx - 2, cy - 2, 5, 5);
    });
  });
  if (version >= 7) {
    fill(n - 11, 0, 3, 6);
    fill(0, n - 11, 6, 3);
  }
  return mask;
}

/** Palette index of the art at sub-dot (x, y) of an s × s bitmap (nearest neighbour). */
function artIndexAt(art: QrArt, x: number, y: number, s: number): number {
  const gx = Math.min(ART_GRID - 1, Math.floor(((x + 0.5) / s) * ART_GRID));
  const gy = Math.min(ART_GRID - 1, Math.floor(((y + 0.5) / s) * ART_GRID));
  return art.indices[gy * ART_GRID + gx] ?? 0;
}

/** Bilinear art lightness at (u, v) in 0..1, for smooth dithering. */
function lightnessSampler(art: QrArt) {
  const lumas = art.palette.map(luma);
  return (u: number, v: number): number => {
    const x = Math.min(ART_GRID - 1, Math.max(0, u * ART_GRID - 0.5));
    const y = Math.min(ART_GRID - 1, Math.max(0, v * ART_GRID - 0.5));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(ART_GRID - 1, x0 + 1);
    const y1 = Math.min(ART_GRID - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    const at = (xx: number, yy: number) => lumas[art.indices[yy * ART_GRID + xx] ?? 0] ?? 1;
    return (
      at(x0, y0) * (1 - fx) * (1 - fy) +
      at(x1, y0) * fx * (1 - fy) +
      at(x0, y1) * (1 - fx) * fy +
      at(x1, y1) * fx * fy
    );
  };
}

/**
 * The 3n × 3n sub-dot bitmap (true = dark). Error diffusion (Floyd–Steinberg)
 * runs over the whole bitmap; the fixed data centres feed their error to their
 * neighbours so the picture stays faithful around them. Then each module is
 * topped up to `minMatch` sub-dots of its own colour.
 */
export function halftoneBitmap(modules: boolean[][], art: QrArt, minMatch = MIN_MATCH): boolean[] {
  const n = modules.length;
  const s = n * 3;
  const mask = functionModuleMask(n);
  const sample = lightnessSampler(art);
  const tone = new Float32Array(s * s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) tone[y * s + x] = 0.08 + 0.84 * sample((x + 0.5) / s, (y + 0.5) / s);
  }
  const out = new Array<boolean>(s * s).fill(false);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const mx = Math.floor(x / 3);
      const my = Math.floor(y / 3);
      const i = y * s + x;
      const value = tone[i]!;
      const isCentre = x % 3 === 1 && y % 3 === 1;
      const solid = mask[my]![mx]!;
      const dark = solid || isCentre ? modules[my]![mx]! : value < 0.5;
      out[i] = dark;
      if (solid) continue; // don't smear solid patterns into the picture
      const err = value - (dark ? 0 : 1);
      if (x + 1 < s) tone[i + 1]! += (err * 7) / 16;
      if (y + 1 < s) {
        if (x > 0) tone[i + s - 1]! += (err * 3) / 16;
        tone[i + s]! += (err * 5) / 16;
        if (x + 1 < s) tone[i + s + 1]! += err / 16;
      }
    }
  }

  // Far away or out of focus, a camera sees each module as the average of its
  // sub-dots. Flip the sub-dots whose picture tone is nearest the module's
  // colour, so the picture suffers least.
  for (let my = 0; my < n; my++) {
    for (let mx = 0; mx < n; mx++) {
      if (mask[my]![mx]) continue;
      const dark = modules[my]![mx]!;
      const ring: { i: number; tone: number }[] = [];
      let matches = 0;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          if (dx === 1 && dy === 1) continue;
          const x = mx * 3 + dx;
          const y = my * 3 + dy;
          const i = y * s + x;
          if (out[i] === dark) matches++;
          else ring.push({ i, tone: sample((x + 0.5) / s, (y + 0.5) / s) });
        }
      }
      if (matches >= minMatch) continue;
      ring.sort((a, b) => (dark ? a.tone - b.tone : b.tone - a.tone));
      for (let k = 0; k < minMatch - matches && k < ring.length; k++) out[ring[k]!.i] = dark;
    }
  }
  return out;
}

/**
 * SVG markup (in sub-dot units, s = 3n) drawing the bitmap in the art's
 * colours: one path per colour, sub-dots merged into horizontal runs. The
 * caller fills the background white first; pure-white light runs are skipped.
 */
export function halftoneSvg(bitmap: boolean[], art: QrArt, s: number): string {
  const colours = new Map<string, string[]>();
  const dark = art.palette.map((c) => hex(darkShade(c)));
  const light = art.palette.map((c) => hex(lightShade(c)));
  const colourAt = (x: number, y: number) => {
    const idx = artIndexAt(art, x, y, s);
    return bitmap[y * s + x] ? dark[idx]! : light[idx]!;
  };
  for (let y = 0; y < s; y++) {
    let x = 0;
    while (x < s) {
      const colour = colourAt(x, y);
      const start = x;
      while (x < s && colourAt(x, y) === colour) x++;
      if (colour === 'ffffff') continue;
      const runs = colours.get(colour) ?? [];
      runs.push(`M${start} ${y}h${x - start}v1h-${x - start}z`);
      colours.set(colour, runs);
    }
  }
  return [...colours]
    .map(([colour, runs]) => `<path fill="#${colour}" d="${runs.join('')}"/>`)
    .join('');
}
