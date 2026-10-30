/**
 * Pure helpers for artwork image fingerprints (DINOv2-small embeddings stored in pgvector).
 * No I/O here so the ranking / confidence logic is unit-testable.
 */

/** DINOv2-small CLS token width. Must match `vector(384)` in artwork_image_embeddings. */
export const IMAGE_EMBEDDING_DIM = 384;

/**
 * Stored alongside every embedding. Bump when the model or preprocessing changes so the
 * backfill script knows which rows to recompute.
 */
export const IMAGE_EMBEDDING_MODEL = 'dinov2-small-q8@8b1f705';

/**
 * Cosine-similarity cut-offs, calibrated on simulated phone re-shots of the 50-piece
 * "Good For One Fare" series (same title/artist/price, one photo each) plus 92 distractors:
 * the true match averaged 0.83–0.89 while the best wrong match averaged ~0.55.
 */
export const STRONG_MATCH_SIMILARITY = 0.75;
export const LIKELY_MATCH_SIMILARITY = 0.62;
/** Below this, results aren't worth showing at all. */
export const MIN_DISPLAY_SIMILARITY = 0.45;
/** If the runner-up is this close to the top hit, a "strong" top hit is downgraded. */
export const AMBIGUOUS_MARGIN = 0.03;

export type MatchConfidence = 'strong' | 'likely' | 'weak';

export function l2Normalize(vector: ArrayLike<number>): number[] {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) sum += vector[i]! * vector[i]!;
  const norm = Math.sqrt(sum);
  if (!norm) return Array.from(vector, () => 0);
  return Array.from(vector, (x) => x / norm);
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

/** pgvector text literal, e.g. `[0.1,0.2]`. PostgREST accepts this for vector params/columns. */
export function toPgVector(vector: ArrayLike<number>): string {
  if (vector.length !== IMAGE_EMBEDDING_DIM) {
    throw new Error(`Expected ${IMAGE_EMBEDDING_DIM}-dim embedding, got ${vector.length}`);
  }
  return `[${Array.from(vector, (x) => {
    if (!Number.isFinite(x)) throw new Error('Embedding contains a non-finite value');
    return Number(x.toFixed(6));
  }).join(',')}]`;
}

export function parsePgVector(value: string | number[]): number[] {
  if (Array.isArray(value)) return value;
  return JSON.parse(value) as number[];
}

export function matchConfidence(similarity: number, runnerUpSimilarity?: number | null): MatchConfidence {
  let level: MatchConfidence =
    similarity >= STRONG_MATCH_SIMILARITY ? 'strong' : similarity >= LIKELY_MATCH_SIMILARITY ? 'likely' : 'weak';
  if (level === 'strong' && runnerUpSimilarity != null && similarity - runnerUpSimilarity < AMBIGUOUS_MARGIN) {
    level = 'likely';
  }
  return level;
}

/**
 * Maps cosine similarity onto a 0–100 score for display. Linear between the "unrelated"
 * floor (~0.45) and a near-identical photo (~0.95); it's a UI hint, not a probability.
 */
export function similarityToPercent(similarity: number): number {
  const lo = MIN_DISPLAY_SIMILARITY;
  const hi = 0.95;
  return Math.round(Math.min(1, Math.max(0, (similarity - lo) / (hi - lo))) * 100);
}

export type RankedMatch<T> = T & {
  similarity: number;
  confidence: MatchConfidence;
  score: number;
};

/**
 * Sorts by similarity, drops anything under `minSimilarity`, and labels confidence. Only the
 * top hit is compared against the runner-up: a lookalike right behind it makes it ambiguous.
 */
export function rankMatches<T extends { similarity: number }>(
  rows: T[],
  { limit = 8, minSimilarity = MIN_DISPLAY_SIMILARITY }: { limit?: number; minSimilarity?: number } = {},
): RankedMatch<T>[] {
  const sorted = [...rows].filter((r) => r.similarity >= minSimilarity).sort((a, b) => b.similarity - a.similarity);
  return sorted.slice(0, limit).map((row, i) => ({
    ...row,
    confidence: matchConfidence(row.similarity, i === 0 ? sorted[1]?.similarity : null),
    score: similarityToPercent(row.similarity),
  }));
}
