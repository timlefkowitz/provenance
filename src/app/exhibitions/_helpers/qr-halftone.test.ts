import { describe, expect, it } from 'vitest';

import {
  ART_GRID,
  MIN_MATCH,
  alignmentPositions,
  darkShade,
  decodeArt,
  encodeArt,
  functionModuleMask,
  halftoneBitmap,
  halftoneSvg,
  isArtGrid,
  lightShade,
  luma,
  parseModules,
  type Rgb,
} from './qr-halftone';
import { composeStyledQr, readQrStyle } from './qr-style';

const WHITE: Rgb = [255, 255, 255];
const RED: Rgb = [179, 38, 46];

/** Left half red, right half white. */
function halfArt(): string {
  const indices = new Uint8Array(ART_GRID * ART_GRID);
  for (let y = 0; y < ART_GRID; y++) for (let x = 0; x < ART_GRID / 2; x++) indices[y * ART_GRID + x] = 1;
  return encodeArt([WHITE, RED], indices);
}

/** A version-2 (25 × 25) module pattern: a checkerboard is enough to test against. */
function checker(n = 25): boolean[][] {
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => (x + y) % 2 === 0));
}

describe('art encoding', () => {
  it('round-trips a palette and indices', () => {
    const art = halfArt();
    expect(isArtGrid(art)).toBe(true);
    const { palette, indices } = decodeArt(art);
    expect(palette).toEqual([WHITE, RED]);
    expect(indices[0]).toBe(1);
    expect(indices[ART_GRID - 1]).toBe(0);
  });

  it('rejects anything that is not stored art', () => {
    expect(isArtGrid('ffffff|AAAA')).toBe(false);
    expect(isArtGrid(`<svg>|${'A'.repeat(17068)}`)).toBe(false);
    expect(isArtGrid(null)).toBe(false);
  });
});

describe('QR structure', () => {
  it('knows the alignment positions', () => {
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(2)).toEqual([6, 18]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(8)).toEqual([6, 24, 42]);
  });

  it('keeps finders, timing and alignment solid', () => {
    const mask = functionModuleMask(25);
    expect(mask[0]![0]).toBe(true); // finder
    expect(mask[6]![12]).toBe(true); // timing
    expect(mask[18]![18]).toBe(true); // alignment centre (version 2)
    expect(mask[12]![12]).toBe(false); // data
  });

  it("reads qrcode.react's path runs", () => {
    const m = parseModules('<path fill="#000000" d="M0 0h3v1H0zM4,1 h1v1H4z"></path>', 5);
    expect(m[0]!.slice(0, 4)).toEqual([true, true, true, false]);
    expect(m[1]![4]).toBe(true);
  });
});

describe('halftoneBitmap', () => {
  it('keeps every module centre and a majority of its sub-dots', () => {
    const modules = checker();
    const art = decodeArt(halfArt());
    const bitmap = halftoneBitmap(modules, art);
    const s = 75;
    for (let my = 0; my < 25; my++) {
      for (let mx = 0; mx < 25; mx++) {
        const want = modules[my]![mx]!;
        expect(bitmap[(my * 3 + 1) * s + mx * 3 + 1]).toBe(want);
        let ring = 0;
        for (let dy = 0; dy < 3; dy++)
          for (let dx = 0; dx < 3; dx++)
            if ((dx !== 1 || dy !== 1) && bitmap[(my * 3 + dy) * s + mx * 3 + dx] === want) ring++;
        expect(ring).toBeGreaterThanOrEqual(MIN_MATCH);
      }
    }
  });

  it('draws in the art colours, shaded to stay scannable', () => {
    const art = decodeArt(halfArt());
    const svg = halftoneSvg(halftoneBitmap(checker(), art), art, 75);
    expect(svg).toMatch(/fill="#[0-9a-f]{6}"/);
    expect(luma(darkShade(RED))).toBeLessThanOrEqual(0.3 + 1e-6);
    expect(luma(darkShade(WHITE))).toBeLessThan(0.06);
    expect(luma(lightShade(RED))).toBeGreaterThanOrEqual(0.75 - 1e-6);
    expect(lightShade(WHITE)).toEqual(WHITE);
  });
});

describe('picture and words styles', () => {
  const BASE =
    '<svg viewBox="0 0 25 25"><path fill="#FFFFFF" d="M0,0 h25v25H0z"></path><path fill="#000000" d="M0 0h7v7H0z"></path></svg>';

  it('falls back to plain until art is saved', () => {
    expect(readQrStyle({ qr: { style: 'picture' } }).style).toBe('plain');
    expect(readQrStyle({ qr: { style: 'words', words: 'hi' } }).style).toBe('plain');
    const saved = readQrStyle({
      qr: { style: 'words', words: ' Photon  Labs ', wordsColour: '#b3262e', wordsArt: halfArt() },
    });
    expect(saved).toMatchObject({ style: 'words', words: 'Photon Labs', wordsColour: '#b3262e' });
  });

  it('has a built-in Sun & grass picture', () => {
    expect(readQrStyle({ qr: { style: 'sunset' } }).style).toBe('sunset');
    const svg = composeStyledQr(BASE, { style: 'sunset', customImage: null });
    expect(svg).toContain('scale(0.3333333333333333)');
    expect(svg).not.toContain('<image');
  });

  it('composes coloured sub-dots with no image', () => {
    const svg = composeStyledQr(BASE, { style: 'picture', customImage: null, pictureArt: halfArt() });
    expect(svg).toContain('viewBox="0 0 31 31"');
    expect(svg).toContain('scale(0.3333333333333333)');
    expect(svg).not.toContain('<image');
  });
});
