/**
 * Server-side image embeddings for reverse image lookup.
 *
 * Model: DINOv2-small (int8 ONNX, ~24 MB) run locally with onnxruntime-node — no paid API.
 * DINOv2 was picked over perceptual hashes and CLIP after benchmarking on near-identical
 * series (see similarity.ts): it is trained for instance-level visual similarity, so two
 * re-shots of the same piece land close together even when every piece shares a palette.
 *
 * Node-only (native onnxruntime + sharp); never import from client components.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';

import { IMAGE_EMBEDDING_DIM, l2Normalize } from './similarity';

/** Pinned to a commit and checked against the LFS sha256 so the model can't change underneath us. */
const MODEL_URL =
  'https://huggingface.co/onnx-community/dinov2-small/resolve/8b1f705a3a7f6f062f6bdd21986c1583d3ef105d/onnx/model_quantized.onnx';
const MODEL_SHA256 = 'c179f8f7f592449c4c1bca4cd124a7538021428c5ffb89afde9503935b197efb';

const INPUT_SIZE = 224;
const RESIZE_SHORTEST_EDGE = 256;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

type OrtModule = typeof import('onnxruntime-node');
type Session = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;

let sessionPromise: Promise<{ ort: OrtModule; session: Session }> | null = null;

async function loadModelBytes(): Promise<Uint8Array> {
  const override = process.env.IMAGE_EMBEDDING_MODEL_PATH;
  if (override) return readFile(override);

  const cachePath = path.join(os.tmpdir(), 'provenance-models', `dinov2-small-q8-${MODEL_SHA256.slice(0, 12)}.onnx`);
  try {
    return await readFile(cachePath);
  } catch {
    // Not cached yet (cold start) — download below.
  }

  const started = Date.now();
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== MODEL_SHA256) throw new Error(`Model checksum mismatch: ${digest}`);

  await mkdir(path.dirname(cachePath), { recursive: true });
  const tmp = `${cachePath}.${process.pid}.tmp`;
  await writeFile(tmp, bytes);
  await rename(tmp, cachePath);
  console.log('[ImageFingerprint] model downloaded', { ms: Date.now() - started, bytes: bytes.length });
  return bytes;
}

function getSession() {
  sessionPromise ??= (async () => {
    const ort = await import('onnxruntime-node');
    const session = await ort.InferenceSession.create(await loadModelBytes(), {
      graphOptimizationLevel: 'all',
    });
    return { ort, session };
  })().catch((err) => {
    sessionPromise = null; // allow a retry on the next call
    throw err;
  });
  return sessionPromise;
}

/**
 * DINOv2 preprocessing (BitImageProcessor): EXIF-rotate, bicubic-resize shortest edge to 256,
 * center-crop 224, ImageNet mean/std, CHW float32.
 */
export async function imageToPixelValues(input: Buffer | Uint8Array): Promise<Float32Array> {
  const { data } = await sharp(input, { failOn: 'none' })
    .rotate()
    .removeAlpha()
    .toColourspace('srgb')
    .resize(RESIZE_SHORTEST_EDGE, RESIZE_SHORTEST_EDGE, { fit: 'outside', kernel: 'cubic' })
    .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'cover', position: 'centre' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const plane = INPUT_SIZE * INPUT_SIZE;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * plane + i] = (data[i * 3 + c]! / 255 - MEAN[c]!) / STD[c]!;
    }
  }
  return out;
}

/** L2-normalised 384-dim embedding (DINOv2 CLS token) for an encoded image (JPEG/PNG/WebP/GIF). */
export async function embedImage(input: Buffer | Uint8Array): Promise<number[]> {
  const [{ ort, session }, pixels] = await Promise.all([getSession(), imageToPixelValues(input)]);
  const tensor = new ort.Tensor('float32', pixels, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const output = await session.run({ pixel_values: tensor });
  const hidden = output.last_hidden_state;
  if (!hidden) throw new Error('Model returned no last_hidden_state');
  const dim = hidden.dims[2];
  if (dim !== IMAGE_EMBEDDING_DIM) throw new Error(`Unexpected embedding width ${dim}`);
  return l2Normalize((hidden.data as Float32Array).subarray(0, dim));
}

/**
 * Embeds many already-preprocessed 3×224×224 tensors (see imageToPixelValues) in batches.
 * Used by the wall scan, which embeds dozens of crops of one photo.
 */
export async function embedPixelBatch(items: Float32Array[], batchSize = 16): Promise<number[][]> {
  const { ort, session } = await getSession();
  const plane = 3 * INPUT_SIZE * INPUT_SIZE;
  const out: number[][] = [];
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    const data = new Float32Array(batch.length * plane);
    batch.forEach((px, i) => data.set(px, i * plane));
    const tensor = new ort.Tensor('float32', data, [batch.length, 3, INPUT_SIZE, INPUT_SIZE]);
    const output = await session.run({ pixel_values: tensor });
    const hidden = output.last_hidden_state;
    if (!hidden) throw new Error('Model returned no last_hidden_state');
    const [, tokens, dim] = hidden.dims as [number, number, number];
    if (dim !== IMAGE_EMBEDDING_DIM) throw new Error(`Unexpected embedding width ${dim}`);
    const values = hidden.data as Float32Array;
    for (let i = 0; i < batch.length; i++) {
      const offset = i * tokens * dim; // CLS token is the first of each item's tokens
      out.push(l2Normalize(values.subarray(offset, offset + dim)));
    }
  }
  return out;
}

/** Downloads with up to 3 attempts (network blips and storage timeouts are common in bulk runs). */
export async function embedImageUrl(url: string, attempts = 3): Promise<number[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) throw Object.assign(new Error('Image fetch failed: HTTP 404'), { permanent: true });
      if (!res.ok) throw new Error(`Image fetch failed: HTTP ${res.status}`);
      return await embedImage(Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      lastError = err;
      if ((err as { permanent?: boolean }).permanent || attempt === attempts) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}
