'use client';

import { ART_GRID, encodeArt, type Rgb } from './qr-halftone';

/** Browser-only: turns an image or words into stored QR art (see qr-halftone.ts). */

const PALETTE_SIZE = 12;

function drawGrid(draw: (ctx: CanvasRenderingContext2D) => void): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = ART_GRID;
  canvas.height = ART_GRID;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, ART_GRID, ART_GRID);
  draw(ctx);
  return ctx.getImageData(0, 0, ART_GRID, ART_GRID).data;
}

/** Median-cut colour quantisation: up to `size` colours and an index per pixel. */
export function quantise(data: ArrayLike<number>, size = PALETTE_SIZE): { palette: Rgb[]; indices: Uint8Array } {
  const count = Math.floor(data.length / 4);
  const pixels: Rgb[] = [];
  for (let i = 0; i < count; i++) pixels.push([data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!]);

  let boxes: Rgb[][] = [pixels];
  while (boxes.length < size) {
    // Split the box with the widest channel range.
    let best = -1;
    let bestRange = 0;
    let bestChannel = 0;
    boxes.forEach((box, b) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255;
        let hi = 0;
        for (const p of box) {
          if (p[c]! < lo) lo = p[c]!;
          if (p[c]! > hi) hi = p[c]!;
        }
        if (hi - lo > bestRange) {
          bestRange = hi - lo;
          best = b;
          bestChannel = c;
        }
      }
    });
    if (best < 0 || bestRange < 8) break;
    const box = boxes[best]!.slice().sort((a, b) => a[bestChannel]! - b[bestChannel]!);
    const mid = Math.floor(box.length / 2);
    boxes = [...boxes.slice(0, best), box.slice(0, mid), box.slice(mid), ...boxes.slice(best + 1)];
  }
  const palette = boxes.map((box) => {
    const sum = [0, 0, 0];
    for (const p of box) for (let c = 0; c < 3; c++) sum[c]! += p[c]!;
    return sum.map((v) => Math.round(v / Math.max(1, box.length))) as Rgb;
  });
  const indices = new Uint8Array(count);
  pixels.forEach((p, i) => {
    let bestIdx = 0;
    let bestDist = Infinity;
    palette.forEach((c, k) => {
      const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = k;
      }
    });
    indices[i] = bestIdx;
  });
  return { palette, indices };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

/** QR art from an image (data URI or object URL), cropped to a centred square. */
export async function artFromImage(src: string): Promise<string> {
  const img = await loadImage(src);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const data = drawGrid((ctx) => {
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      ART_GRID,
      ART_GRID,
    );
  });
  const { palette, indices } = quantise(data);
  return encodeArt(palette, indices);
}

/** Splits words into up to four lines, preferring a squarish block. */
function layoutLines(text: string): string[] {
  const words = text.split(' ').filter(Boolean);
  if (words.length <= 1) return words;
  let best: string[] = [text];
  let bestScore = Infinity;
  for (let lines = 1; lines <= Math.min(4, words.length); lines++) {
    const target = text.length / lines;
    const out: string[] = [];
    let current = '';
    for (const w of words) {
      if (current && `${current} ${w}`.length > target * 1.25 && out.length < lines - 1) {
        out.push(current);
        current = w;
      } else {
        current = current ? `${current} ${w}` : w;
      }
    }
    out.push(current);
    const width = Math.max(...out.map((l) => l.length));
    const score = Math.abs(width * 0.55 - out.length * 1.1);
    if (score < bestScore) {
      bestScore = score;
      best = out;
    }
  }
  return best;
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) || 0) as Rgb;
}

/**
 * QR art with the words lettered large and bold in `colour`. Short blocks of
 * text are stretched taller so the letters stay big enough to see in the dots.
 */
export async function artFromWords(text: string, colour: string): Promise<string> {
  try {
    await document.fonts?.ready;
  } catch {
    // Fall back to whatever font is available.
  }
  const lines = layoutLines(text.trim());
  const family = "Georgia, 'Times New Roman', serif";
  const data = drawGrid((ctx) => {
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const avail = ART_GRID * 0.86;
    let size = avail / lines.length / 1.05;
    ctx.font = `700 ${size}px ${family}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
    size = Math.min(size, (size * avail) / widest);
    ctx.font = `700 ${size}px ${family}`;
    const lineHeight = size * 1.05;
    const blockHeight = lineHeight * lines.length;
    // Stretch vertically up to 2.2× to fill the square.
    const stretch = Math.min(2.2, Math.max(1, (avail * 0.8) / blockHeight));
    ctx.translate(ART_GRID / 2, ART_GRID / 2);
    ctx.scale(1, stretch);
    const top = -(lineHeight * (lines.length - 1)) / 2;
    lines.forEach((line, i) => ctx.fillText(line, 0, top + i * lineHeight));
  });
  const indices = new Uint8Array(ART_GRID * ART_GRID);
  for (let i = 0; i < indices.length; i++) indices[i] = data[i * 4]! < 128 ? 1 : 0;
  return encodeArt([[255, 255, 255], hexToRgb(colour)], indices);
}
