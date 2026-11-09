/**
 * Wall scan: finds which of a known set of artworks hang in one photo of a wall, where each
 * one is, and their left-to-right order.
 *
 * The reverse image lookup embeds a whole photo as one DINOv2 vector, which only works when
 * the photo is of a single piece. Here the wall photo is cut into many overlapping windows
 * (several sizes and shapes), each window is embedded, and every window is compared with
 * the candidates' stored embeddings (an exhibition's works, so dozens, not thousands). The
 * best windows around each likely hit are then refined, and a greedy pass keeps the
 * strongest (window, artwork) pairs whose windows don't overlap.
 *
 * Node-only (sharp + onnxruntime); never import from client components.
 */
import sharp from 'sharp';

import { embedPixelBatch } from './embed';
import type { MatchConfidence } from './similarity';

const INPUT_SIZE = 224;
const RESIZE_SHORTEST_EDGE = 256;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** The photo is scaled so its longest side is this before cropping windows. */
const WORK_LONG_EDGE = 1280;

/** Window heights as a fraction of the photo height, and window shapes (width / height). */
const WINDOW_HEIGHTS = [0.24, 0.36, 0.52, 0.72, 0.92];
const WINDOW_ASPECTS = [0.75, 1.3];
/** Step between neighbouring coarse windows, as a fraction of the window's own size. */
const COARSE_STRIDE = 0.55;

/** Windows at least this similar to an artwork get a finer search around them. */
const REFINE_FLOOR = 0.5;
/** Cap on refined windows per round, so a big show can't blow up the scan time. */
const MAX_REFINE_SEEDS = 16;
/** Refinement rounds; each round searches around the best window so far, at half the step. */
const REFINE_ROUNDS = 3;

/**
 * Lowest similarity at which a window counts as the artwork. Lower than the single-photo
 * lookup's cut-offs: a window never frames the piece as tightly as a photo of it, and
 * candidates are already limited to the exhibition's works.
 */
export const WALL_MATCH_SIMILARITY = 0.62;

/**
 * Confidence from similarity plus the margin over the next-best work in the same window.
 * Calibrated on synthetic walls of real exhibition photos (49 hangs): every true hit beat
 * its runner-up by ≥0.09, while false hits (part wall, part frame) were within 0.10 and
 * scored ≤0.69. A very high similarity with a small margin is a lookalike series, not noise.
 */
export function wallConfidence(similarity: number, runnerUp: number | null): MatchConfidence {
  const margin = similarity - (runnerUp ?? 0);
  if (similarity >= 0.85 || (similarity >= 0.75 && margin >= 0.1)) return 'strong';
  // Lookalike series (one artist's run of collages, say) leave a small margin even for the
  // right work, so a high similarity alone still counts.
  if (similarity >= 0.72 || (similarity >= WALL_MATCH_SIMILARITY && margin >= 0.08)) return 'likely';
  return 'weak';
}

/** Fractions of the photo (0–1), origin top-left. */
export type WallBox = { x: number; y: number; w: number; h: number };

export type WallReference = { artworkId: string; embedding: number[] };

export type WallPlacement = {
  artworkId: string;
  box: WallBox;
  similarity: number;
  /** Next-best artwork for the same window, for spotting lookalikes. */
  runnerUpSimilarity: number | null;
  confidence: MatchConfidence;
};

export type WallScanResult = {
  /** Left to right. */
  placements: WallPlacement[];
  /** Photo size after EXIF rotation, in pixels. */
  width: number;
  height: number;
  windowsScanned: number;
};

type Raw = { data: Buffer; width: number; height: number };

async function decode(photo: Buffer | Uint8Array): Promise<Raw & { originalWidth: number; originalHeight: number }> {
  const rotated = sharp(photo, { failOn: 'none' }).rotate();
  const { data, info } = await rotated
    .removeAlpha()
    .toColourspace('srgb')
    .resize(WORK_LONG_EDGE, WORK_LONG_EDGE, { fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const meta = await sharp(photo, { failOn: 'none' }).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  return {
    data,
    width: info.width,
    height: info.height,
    originalWidth: (swap ? meta.height : meta.width) ?? info.width,
    originalHeight: (swap ? meta.width : meta.height) ?? info.height,
  };
}

function clampBox(b: WallBox): WallBox | null {
  const w = Math.min(b.w, 1);
  const h = Math.min(b.h, 1);
  const x = Math.min(Math.max(b.x, 0), 1 - w);
  const y = Math.min(Math.max(b.y, 0), 1 - h);
  if (w < 0.04 || h < 0.04) return null;
  return { x, y, w, h };
}

/**
 * Windows flatter than this (std-dev of brightness, 0–255) are bare wall. Many stored artwork
 * photos include wall around the piece, so bare wall would otherwise match them.
 */
const MIN_WINDOW_CONTRAST = 14;

/**
 * Same preprocessing as imageToPixelValues, applied to one region of the decoded photo, plus
 * the region's brightness spread so bare wall can be skipped.
 */
async function windowPixels(raw: Raw, box: WallBox): Promise<{ pixels: Float32Array; contrast: number }> {
  const left = Math.round(box.x * raw.width);
  const top = Math.round(box.y * raw.height);
  const width = Math.max(1, Math.min(raw.width - left, Math.round(box.w * raw.width)));
  const height = Math.max(1, Math.min(raw.height - top, Math.round(box.h * raw.height)));
  const { data } = await sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: 3 } })
    .extract({ left, top, width, height })
    .resize(RESIZE_SHORTEST_EDGE, RESIZE_SHORTEST_EDGE, { fit: 'outside', kernel: 'cubic' })
    .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'cover', position: 'centre' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const plane = INPUT_SIZE * INPUT_SIZE;
  const out = new Float32Array(3 * plane);
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) out[c * plane + i] = (data[i * 3 + c]! / 255 - MEAN[c]!) / STD[c]!;
    const luma = 0.299 * data[i * 3]! + 0.587 * data[i * 3 + 1]! + 0.114 * data[i * 3 + 2]!;
    sum += luma;
    sumSq += luma * luma;
  }
  const mean = sum / plane;
  return { pixels: out, contrast: Math.sqrt(Math.max(0, sumSq / plane - mean * mean)) };
}

/** Coarse grid of windows over the whole photo. `photoAspect` is width / height in pixels. */
export function coarseWindows(photoAspect: number): WallBox[] {
  const boxes: WallBox[] = [];
  for (const h of WINDOW_HEIGHTS) {
    for (const aspect of WINDOW_ASPECTS) {
      const w = (h * aspect) / photoAspect; // window width as a fraction of photo width
      if (w > 1) continue;
      const stepX = Math.max(w * COARSE_STRIDE, 0.01);
      const stepY = Math.max(h * COARSE_STRIDE, 0.01);
      const nx = Math.max(1, Math.ceil((1 - w) / stepX - 1e-9) + 1);
      const ny = Math.max(1, Math.ceil((1 - h) / stepY - 1e-9) + 1);
      for (let iy = 0; iy < ny; iy++) {
        for (let ix = 0; ix < nx; ix++) {
          // Spread the last step so windows touch both edges.
          const x = nx === 1 ? (1 - w) / 2 : (ix * (1 - w)) / (nx - 1);
          const y = ny === 1 ? (1 - h) / 2 : (iy * (1 - h)) / (ny - 1);
          boxes.push({ x, y, w, h });
        }
      }
    }
  }
  return boxes;
}

/** Shifted and rescaled copies of a window, for the refinement rounds. */
export function neighbourWindows(box: WallBox, step: number): WallBox[] {
  const out: WallBox[] = [];
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const add = (dx: number, dy: number, sw: number, sh: number) => {
    const w = box.w * sw;
    const h = box.h * sh;
    const b = clampBox({ x: cx + dx * step * box.w - w / 2, y: cy + dy * step * box.h - h / 2, w, h });
    if (b) out.push(b);
  };
  // Shifts at the same size.
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (dx || dy) add(dx, dy, 1, 1);
  // Grow / shrink in place, and change shape.
  for (const s of [1 - step, 1 + step]) {
    add(0, 0, s, s);
    add(0, 0, s, 1);
    add(0, 0, 1, s);
  }
  return out;
}

export function intersectionOverSmaller(a: WallBox, b: WallBox): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  if (!inter) return 0;
  return inter / Math.min(a.w * a.h, b.w * b.h);
}

type Scored = { box: WallBox; sims: Float32Array };

/**
 * Greedy one-to-one assignment: the strongest (window, artwork) pair wins, then the next
 * strongest whose artwork is still free and whose window doesn't sit on top of an accepted
 * one. Returned left to right (by window centre; works whose centres line up vertically are
 * read top to bottom).
 */
export function assignPlacements(
  windows: Scored[],
  artworkIds: string[],
  { minSimilarity = WALL_MATCH_SIMILARITY, maxOverlap = 0.2 } = {},
): WallPlacement[] {
  const pairs: { w: number; a: number; sim: number }[] = [];
  windows.forEach((win, w) => {
    win.sims.forEach((sim, a) => {
      if (sim >= minSimilarity) pairs.push({ w, a, sim });
    });
  });
  pairs.sort((p, q) => q.sim - p.sim);

  const usedArtworks = new Set<number>();
  const accepted: WallPlacement[] = [];
  for (const { w, a, sim } of pairs) {
    if (usedArtworks.has(a)) continue;
    // A window that looks more like another work is a slice of that work, not this one.
    if (windows[w]!.sims.some((other, i) => i !== a && other > sim)) continue;
    const box = windows[w]!.box;
    if (accepted.some((p) => intersectionOverSmaller(p.box, box) > maxOverlap)) continue;
    usedArtworks.add(a);
    let runnerUp: number | null = null;
    windows[w]!.sims.forEach((s, other) => {
      if (other !== a && (runnerUp === null || s > runnerUp)) runnerUp = s;
    });
    accepted.push({
      artworkId: artworkIds[a]!,
      box,
      similarity: sim,
      runnerUpSimilarity: runnerUp,
      confidence: wallConfidence(sim, runnerUp),
    });
  }
  return sortLeftToRight(accepted);
}

/** Left to right by centre; pieces stacked in the same column read top to bottom. */
export function sortLeftToRight<T extends { box: WallBox }>(items: T[]): T[] {
  const cx = (b: WallBox) => b.x + b.w / 2;
  const cy = (b: WallBox) => b.y + b.h / 2;
  return [...items].sort((p, q) => {
    const sameColumn = Math.abs(cx(p.box) - cx(q.box)) < Math.min(p.box.w, q.box.w) / 3;
    return sameColumn ? cy(p.box) - cy(q.box) : cx(p.box) - cx(q.box);
  });
}

function dotAll(vec: number[], refs: number[][]): Float32Array {
  const out = new Float32Array(refs.length);
  refs.forEach((ref, i) => {
    let dot = 0;
    for (let k = 0; k < vec.length; k++) dot += vec[k]! * ref[k]!;
    out[i] = dot;
  });
  return out;
}

const boxKey = (b: WallBox) => [b.x, b.y, b.w, b.h].map((v) => v.toFixed(3)).join(',');

export async function scanWall(photo: Buffer | Uint8Array, references: WallReference[]): Promise<WallScanResult> {
  const raw = await decode(photo);
  if (!references.length) {
    return { placements: [], width: raw.originalWidth, height: raw.originalHeight, windowsScanned: 0 };
  }
  const refs = references.map((r) => r.embedding);
  const ids = references.map((r) => r.artworkId);
  const seen = new Map<string, Scored>();

  const score = async (boxes: WallBox[]) => {
    const keys = new Set<string>();
    const fresh = boxes.filter((b) => {
      const key = boxKey(b);
      if (seen.has(key) || keys.has(key)) return false;
      keys.add(key);
      return true;
    });
    const crops = (await Promise.all(fresh.map(async (box) => ({ box, ...(await windowPixels(raw, box)) })))).filter(
      (c) => {
        if (c.contrast >= MIN_WINDOW_CONTRAST) return true;
        seen.set(boxKey(c.box), { box: c.box, sims: new Float32Array(refs.length) }); // bare wall
        return false;
      },
    );
    const vecs = await embedPixelBatch(crops.map((c) => c.pixels));
    crops.forEach((c, i) => seen.set(boxKey(c.box), { box: c.box, sims: dotAll(vecs[i]!, refs) }));
  };

  await score(coarseWindows(raw.width / raw.height));

  // Refine around each artwork's best windows, a few rounds at a shrinking step.
  let step = 0.2;
  for (let round = 0; round < REFINE_ROUNDS; round++) {
    const seeds = new Map<number, Scored>(); // artwork index → its best window so far
    for (const scored of seen.values()) {
      let top = 0;
      scored.sims.forEach((v, i) => {
        if (v > scored.sims[top]!) top = i;
      });
      const sim = scored.sims[top]!;
      if (sim < REFINE_FLOOR) continue;
      const prev = seeds.get(top);
      if (!prev || prev.sims[top]! < sim) seeds.set(top, scored);
    }
    if (!seeds.size) break;
    const strongest = [...seeds.entries()]
      .sort(([a, p], [b, q]) => q.sims[b]! - p.sims[a]!)
      .slice(0, MAX_REFINE_SEEDS);
    await score(strongest.flatMap(([, s]) => neighbourWindows(s.box, step)));
    step /= 2;
  }

  return {
    placements: assignPlacements([...seen.values()], ids),
    width: raw.originalWidth,
    height: raw.originalHeight,
    windowsScanned: seen.size,
  };
}
