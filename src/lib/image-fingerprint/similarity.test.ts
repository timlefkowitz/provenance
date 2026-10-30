import { describe, expect, it } from 'vitest';

import {
  AMBIGUOUS_MARGIN,
  IMAGE_EMBEDDING_DIM,
  LIKELY_MATCH_SIMILARITY,
  STRONG_MATCH_SIMILARITY,
  cosineSimilarity,
  l2Normalize,
  matchConfidence,
  parsePgVector,
  rankMatches,
  similarityToPercent,
  toPgVector,
} from './similarity';

describe('l2Normalize / cosineSimilarity', () => {
  it('normalises to unit length', () => {
    const v = l2Normalize([3, 4]);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
  });

  it('leaves a zero vector as zeros instead of NaN', () => {
    expect(l2Normalize([0, 0, 0])).toEqual([0, 0, 0]);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
  });

  it('is 1 for parallel, 0 for orthogonal, -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 5])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1);
  });

  it('rejects mismatched dimensions', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/Dimension mismatch/);
  });
});

describe('toPgVector / parsePgVector', () => {
  it('round-trips a 384-dim embedding', () => {
    const v = l2Normalize(Array.from({ length: IMAGE_EMBEDDING_DIM }, (_, i) => Math.sin(i)));
    const literal = toPgVector(v);
    expect(literal.startsWith('[')).toBe(true);
    const back = parsePgVector(literal);
    expect(back).toHaveLength(IMAGE_EMBEDDING_DIM);
    expect(cosineSimilarity(v, back)).toBeCloseTo(1, 6);
  });

  it('refuses the wrong width or non-finite values', () => {
    expect(() => toPgVector([1, 2, 3])).toThrow(/384/);
    const bad = Array.from({ length: IMAGE_EMBEDDING_DIM }, () => 0);
    bad[5] = Number.NaN;
    expect(() => toPgVector(bad)).toThrow(/non-finite/);
  });
});

describe('matchConfidence', () => {
  it('buckets by similarity', () => {
    expect(matchConfidence(STRONG_MATCH_SIMILARITY + 0.05)).toBe('strong');
    expect(matchConfidence(LIKELY_MATCH_SIMILARITY + 0.01)).toBe('likely');
    expect(matchConfidence(LIKELY_MATCH_SIMILARITY - 0.01)).toBe('weak');
  });

  it('downgrades a strong hit when a lookalike is right behind it', () => {
    expect(matchConfidence(0.86, 0.86 - AMBIGUOUS_MARGIN / 2)).toBe('likely');
    expect(matchConfidence(0.86, 0.6)).toBe('strong');
  });
});

describe('similarityToPercent', () => {
  it('clamps to 0–100 and is monotonic', () => {
    expect(similarityToPercent(0.1)).toBe(0);
    expect(similarityToPercent(0.99)).toBe(100);
    expect(similarityToPercent(0.7)).toBeLessThan(similarityToPercent(0.8));
  });
});

describe('rankMatches', () => {
  // Shape of the real use case: ~70 lookalike listings, one true match.
  const lookalikes = Array.from({ length: 70 }, (_, i) => ({ id: `magnet-${i}`, similarity: 0.5 + (i % 7) * 0.01 }));

  it('puts the true match first and labels it strong', () => {
    const rows = [...lookalikes, { id: 'magnet-true', similarity: 0.84 }];
    const ranked = rankMatches(rows, { limit: 5 });
    expect(ranked[0]).toMatchObject({ id: 'magnet-true', confidence: 'strong' });
    expect(ranked).toHaveLength(5);
    expect(ranked.map((r) => r.similarity)).toEqual([...ranked.map((r) => r.similarity)].sort((a, b) => b - a));
  });

  it('drops results under the display floor', () => {
    const ranked = rankMatches([{ id: 'a', similarity: 0.2 }, { id: 'b', similarity: 0.7 }]);
    expect(ranked.map((r) => r.id)).toEqual(['b']);
  });

  it('flags an ambiguous top hit and grades runner-ups on their own score', () => {
    const ranked = rankMatches([
      { id: 'a', similarity: 0.88 },
      { id: 'b', similarity: 0.87 },
      { id: 'c', similarity: 0.5 },
    ]);
    expect(ranked[0]!.confidence).toBe('likely');
    expect(ranked[1]!.confidence).toBe('strong');
    expect(ranked[2]!.confidence).toBe('weak');
  });

  it('does not mutate its input', () => {
    const rows = [{ id: 'a', similarity: 0.5 }, { id: 'b', similarity: 0.9 }];
    rankMatches(rows);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
