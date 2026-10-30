import { existsSync } from 'node:fs';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { embedImage, imageToPixelValues } from './embed';
import { cosineSimilarity, rankMatches } from './similarity';

let seed = 7;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!;

/**
 * A "series" of lookalike pieces: same cream card, same palette, same size — only the
 * arrangement of marks differs, like a run of hand-painted magnets.
 */
function lookalikeSvg(): string {
  const palette = ['#7a1f2b', '#1f3a5f', '#d9a441', '#2f5d3a', '#111111'];
  const marks = Array.from({ length: 9 }, () => {
    const x = 40 + rnd() * 320;
    const y = 40 + rnd() * 320;
    const r = 12 + rnd() * 50;
    return rnd() > 0.5
      ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${pick(palette)}"/>`
      : `<rect x="${x - r}" y="${y - r / 2}" width="${r * 2}" height="${r}" transform="rotate(${rnd() * 90} ${x} ${y})" fill="${pick(palette)}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#f3ead8"/>${marks}</svg>`;
}

/** Simulated phone re-shot: crop, tilt, coloured background, exposure/tint shift, blur, JPEG. */
async function reshoot(png: Buffer): Promise<Buffer> {
  const crop = Math.round(20 * rnd());
  const angle = (rnd() - 0.5) * 12;
  return sharp(png)
    .extract({ left: crop, top: crop, width: 400 - 2 * crop, height: 400 - 2 * crop })
    .extend({ top: 30, bottom: 30, left: 30, right: 30, background: { r: 120, g: 110, b: 95 } })
    .rotate(angle, { background: { r: 120, g: 110, b: 95 } })
    .modulate({ brightness: 0.8 + rnd() * 0.35, saturation: 0.85 + rnd() * 0.3 })
    .linear([1 + (rnd() - 0.5) * 0.2, 1, 1 + (rnd() - 0.5) * 0.2], [0, 0, 0])
    .blur(0.3 + rnd())
    .jpeg({ quality: 55 })
    .toBuffer();
}

describe('imageToPixelValues', () => {
  it('produces a normalised 3×224×224 tensor regardless of input size or aspect', async () => {
    const wide = await sharp({ create: { width: 900, height: 300, channels: 4, background: '#ffffff' } })
      .png()
      .toBuffer();
    const px = await imageToPixelValues(wide);
    expect(px).toHaveLength(3 * 224 * 224);
    // White → (1 - mean) / std for each channel.
    expect(px[0]).toBeCloseTo((1 - 0.485) / 0.229, 3);
    expect(px[224 * 224]).toBeCloseTo((1 - 0.456) / 0.224, 3);
    expect(px[2 * 224 * 224]).toBeCloseTo((1 - 0.406) / 0.225, 3);
  });
});

/**
 * Runs the real DINOv2 model. Needs IMAGE_EMBEDDING_MODEL_PATH (a local copy of the ONNX
 * file) or IMAGE_FINGERPRINT_E2E=1 to allow the pinned 24 MB download.
 */
const modelAvailable =
  (process.env.IMAGE_EMBEDDING_MODEL_PATH && existsSync(process.env.IMAGE_EMBEDDING_MODEL_PATH)) ||
  process.env.IMAGE_FINGERPRINT_E2E === '1';

describe.skipIf(!modelAvailable)('embedImage (DINOv2)', () => {
  it(
    'identifies each piece of a lookalike series from a re-shot photo, never confidently wrong',
    async () => {
      const originals = await Promise.all(
        Array.from({ length: 20 }, () => sharp(Buffer.from(lookalikeSvg())).png().toBuffer()),
      );
      const refs = [];
      for (const [i, png] of originals.entries()) refs.push({ id: i, vec: await embedImage(png) });

      const queries = await Promise.all(originals.map((png) => reshoot(png)));
      let top1 = 0;
      let top3 = 0;
      let confidentlyWrong = 0;
      for (const [i, q] of queries.entries()) {
        const qv = await embedImage(q);
        const ranked = rankMatches(
          refs.map((r) => ({ id: r.id, similarity: cosineSimilarity(qv, r.vec) })),
          { minSimilarity: 0 },
        );
        if (ranked[0]!.id === i) top1++;
        else if (ranked[0]!.confidence === 'strong') confidentlyWrong++;
        if (ranked.slice(0, 3).some((r) => r.id === i)) top3++;
      }
      // Synthetic cards are far more alike than real pieces (real series scored 99–100% top-1),
      // so allow a near miss but never a wrong answer labelled "strong".
      expect(top1).toBeGreaterThanOrEqual(17);
      expect(top3).toBe(20);
      expect(confidentlyWrong).toBe(0);
    },
    120_000,
  );

  it('returns a unit-length 384-dim vector and is stable for the same image', async () => {
    const png = await sharp(Buffer.from(lookalikeSvg())).png().toBuffer();
    const [a, b] = [await embedImage(png), await embedImage(png)];
    expect(a).toHaveLength(384);
    expect(Math.hypot(...a)).toBeCloseTo(1, 5);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 6);
  }, 60_000);
});
