#!/usr/bin/env tsx
/**
 * Backfill reverse-image-lookup embeddings (artwork_image_embeddings) for existing artworks.
 * Also repairs stale rows: image changed since the embedding was made, or an older model.
 * Safe to re-run; up-to-date rows are skipped.
 *
 * Run (needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   pnpm fingerprints:backfill                      # all artworks with an image
 *   pnpm fingerprints:backfill --exhibition <id>    # one exhibition only
 *   pnpm fingerprints:backfill --dry-run            # just report what would change
 *   pnpm fingerprints:backfill --force              # recompute everything
 *
 * Failed images are reported and left for the next run, so re-run until it reports 0 to do.
 *
 * Set IMAGE_EMBEDDING_MODEL_PATH to a local copy of the ONNX model to skip the download.
 */
import { createClient } from '@supabase/supabase-js';

import { refreshArtworkFingerprints } from '../src/lib/image-fingerprint/store';
import { IMAGE_EMBEDDING_MODEL } from '../src/lib/image-fingerprint/similarity';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const dryRun = flag('dry-run');
const force = flag('force');
const exhibitionId = option('exhibition');
const BATCH = 25;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const rows: { id: string; image_url: string | null }[] = [];
  if (exhibitionId) {
    const { data, error } = await admin.from('exhibition_artworks').select('artwork_id').eq('exhibition_id', exhibitionId);
    if (error) throw error;
    const linked = (data ?? []).map((r) => r.artwork_id as string);
    for (let i = 0; i < linked.length; i += 100) {
      const { data: aw, error: awErr } = await admin.from('artworks').select('id, image_url').in('id', linked.slice(i, i + 100));
      if (awErr) throw awErr;
      rows.push(...(aw ?? []));
    }
  } else {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from('artworks')
        .select('id, image_url')
        .not('image_url', 'is', null)
        .order('created_at', { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  const ids = rows.map((r) => r.id);

  const have = new Map<string, { model: string; source_image_url: string }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('artwork_image_embeddings')
      .select('artwork_id, model, source_image_url')
      .order('artwork_id')
      .range(from, from + 999);
    if (error) throw new Error(`${error.message} (has the artwork_image_embeddings migration been applied?)`);
    for (const r of data ?? []) have.set(r.artwork_id as string, r);
    if (!data || data.length < 1000) break;
  }

  const todo = force
    ? ids
    : rows
        .filter((r) => {
          const row = have.get(r.id);
          if (!r.image_url) return Boolean(row); // image removed → delete the embedding
          return !row || row.model !== IMAGE_EMBEDDING_MODEL || row.source_image_url !== r.image_url;
        })
        .map((r) => r.id);

  console.log(`[backfill] ${ids.length} artworks in scope, ${todo.length} need an embedding (model ${IMAGE_EMBEDDING_MODEL})`);
  if (dryRun || !todo.length) return;

  const totals = { updated: 0, removed: 0, skipped: 0, failed: 0 };
  const started = Date.now();
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    let r;
    try {
      r = await refreshArtworkFingerprints(admin, batch, { force });
    } catch (err) {
      // e.g. a transient Supabase error loading the batch; skip it, a re-run picks it up.
      console.warn(`[backfill] batch at ${i} failed, skipping: ${err instanceof Error ? err.message : err}`);
      totals.failed += batch.length;
      continue;
    }
    totals.updated += r.updated;
    totals.removed += r.removed;
    totals.skipped += r.skipped;
    totals.failed += r.failed.length;
    for (const f of r.failed) console.warn(`[backfill] failed ${f.artworkId}: ${f.error}`);
    console.log(`[backfill] ${Math.min(i + BATCH, todo.length)}/${todo.length} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }
  console.log('[backfill] done', totals);
  if (totals.failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[backfill] fatal', err);
  // Not process.exit(): exiting while the onnxruntime session is alive aborts in native code.
  process.exitCode = 1;
});
