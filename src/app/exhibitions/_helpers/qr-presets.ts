import { ART_GRID, encodeArt, type Rgb } from './qr-halftone';

/**
 * Built-in art for QR styles, computed rather than stored so it needs no
 * canvas and nothing saved with the exhibition.
 */

const ORANGE: Rgb = [255, 122, 0];
const BLUE: Rgb = [42, 108, 255];
const SUN: Rgb = [255, 225, 77];
const GRASS: Rgb = [27, 122, 46];
const SKY_STEPS = 10;

let sunset: string | null = null;

/**
 * "Sun & grass": a sky fading from orange (top left) to blue (bottom right),
 * a yellow sun and a strip of green field.
 */
export function sunsetArt(): string {
  if (sunset) return sunset;
  const sky: Rgb[] = Array.from({ length: SKY_STEPS }, (_, i) => {
    const t = i / (SKY_STEPS - 1);
    return ORANGE.map((v, c) => Math.round(v + (BLUE[c]! - v) * t)) as Rgb;
  });
  const palette = [...sky, SUN, GRASS];
  const sunIndex = SKY_STEPS;
  const grassIndex = SKY_STEPS + 1;
  const indices = new Uint8Array(ART_GRID * ART_GRID);
  for (let y = 0; y < ART_GRID; y++) {
    for (let x = 0; x < ART_GRID; x++) {
      const u = (x + 0.5) / ART_GRID;
      const v = (y + 0.5) / ART_GRID;
      let idx: number;
      if (v >= 0.75) idx = grassIndex;
      else if ((u - 0.5) ** 2 + (v - 0.425) ** 2 <= 0.225 ** 2) idx = sunIndex;
      else idx = Math.min(SKY_STEPS - 1, Math.floor(((u + v) / 2) * SKY_STEPS));
      indices[y * ART_GRID + x] = idx;
    }
  }
  sunset = encodeArt(palette, indices);
  return sunset;
}
