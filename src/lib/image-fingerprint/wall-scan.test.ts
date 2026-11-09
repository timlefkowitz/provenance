import { describe, expect, it } from 'vitest';

import {
  assignPlacements,
  coarseWindows,
  intersectionOverSmaller,
  neighbourWindows,
  sortLeftToRight,
  wallConfidence,
  type WallBox,
} from './wall-scan';

const win = (box: WallBox, sims: number[]) => ({ box, sims: Float32Array.from(sims) });

describe('coarseWindows', () => {
  it('stays inside the photo and reaches every edge', () => {
    for (const aspect of [16 / 9, 4 / 3, 1, 3 / 4]) {
      const boxes = coarseWindows(aspect);
      expect(boxes.length).toBeGreaterThan(20);
      expect(boxes.length).toBeLessThan(400); // ~10 ms each to embed
      for (const b of boxes) {
        expect(b.x).toBeGreaterThanOrEqual(-1e-9);
        expect(b.y).toBeGreaterThanOrEqual(-1e-9);
        expect(b.x + b.w).toBeLessThanOrEqual(1 + 1e-9);
        expect(b.y + b.h).toBeLessThanOrEqual(1 + 1e-9);
      }
      expect(boxes.some((b) => Math.abs(b.x + b.w - 1) < 1e-9)).toBe(true);
      expect(boxes.some((b) => Math.abs(b.y + b.h - 1) < 1e-9)).toBe(true);
    }
  });
});

describe('neighbourWindows', () => {
  it('returns shifted and resized copies clamped to the photo', () => {
    const near = neighbourWindows({ x: 0, y: 0, w: 0.2, h: 0.3 }, 0.2);
    expect(near.length).toBeGreaterThan(8);
    for (const b of near) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('assignPlacements', () => {
  const left = { x: 0.05, y: 0.3, w: 0.2, h: 0.3 };
  const middle = { x: 0.4, y: 0.3, w: 0.2, h: 0.3 };
  const right = { x: 0.75, y: 0.3, w: 0.2, h: 0.3 };

  it('orders found works left to right, not by score', () => {
    const placements = assignPlacements(
      [win(right, [0.9, 0.2, 0.3]), win(left, [0.3, 0.85, 0.2]), win(middle, [0.2, 0.3, 0.8])],
      ['a', 'b', 'c'],
    );
    expect(placements.map((p) => p.artworkId)).toEqual(['b', 'c', 'a']);
  });

  it('uses each work once and keeps windows from overlapping', () => {
    const shifted = { ...left, x: left.x + 0.02 };
    const placements = assignPlacements([win(left, [0.9, 0.7]), win(shifted, [0.88, 0.75])], ['a', 'b']);
    expect(placements).toHaveLength(1);
    expect(placements[0]!.artworkId).toBe('a');
  });

  it('skips a window that looks more like a work already placed (a slice of it)', () => {
    // The slice next to `a` resembles `a` (0.8) more than `b` (0.66): it must not become `b`.
    const slice = { x: 0.26, y: 0.3, w: 0.1, h: 0.3 };
    const placements = assignPlacements([win(left, [0.9, 0.3]), win(slice, [0.8, 0.66])], ['a', 'b']);
    expect(placements.map((p) => p.artworkId)).toEqual(['a']);
  });

  it('drops windows below the threshold', () => {
    expect(assignPlacements([win(left, [0.5, 0.2])], ['a', 'b'])).toEqual([]);
  });
});

describe('sortLeftToRight', () => {
  it('reads a stacked column top to bottom', () => {
    const items = [
      { id: 'lower', box: { x: 0.1, y: 0.55, w: 0.2, h: 0.3 } },
      { id: 'right', box: { x: 0.6, y: 0.2, w: 0.2, h: 0.3 } },
      { id: 'upper', box: { x: 0.12, y: 0.1, w: 0.2, h: 0.3 } },
    ];
    expect(sortLeftToRight(items).map((i) => i.id)).toEqual(['upper', 'lower', 'right']);
  });
});

describe('wallConfidence', () => {
  it('needs a clear margin over the next-best work unless the match is near-identical', () => {
    expect(wallConfidence(0.9, 0.88)).toBe('strong'); // lookalike series
    expect(wallConfidence(0.8, 0.5)).toBe('strong');
    expect(wallConfidence(0.69, 0.6)).toBe('likely');
    expect(wallConfidence(0.69, 0.66)).toBe('weak'); // part wall, part frame
    expect(wallConfidence(0.6, 0.1)).toBe('weak');
  });
});

describe('intersectionOverSmaller', () => {
  it('is 1 when one box contains the other and 0 when apart', () => {
    expect(intersectionOverSmaller({ x: 0, y: 0, w: 1, h: 1 }, { x: 0.2, y: 0.2, w: 0.1, h: 0.1 })).toBeCloseTo(1);
    expect(intersectionOverSmaller({ x: 0, y: 0, w: 0.2, h: 0.2 }, { x: 0.5, y: 0.5, w: 0.2, h: 0.2 })).toBe(0);
  });
});
