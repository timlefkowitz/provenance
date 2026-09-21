export type LinkedArtwork = { id: string; title: string; image_url: string | null };

/**
 * Combine the lead's legacy single `artwork` with the artworks from the
 * many-to-many link table into one de-duplicated list, legacy artwork first.
 */
export function mergeLeadArtworks(
  legacy: LinkedArtwork | null | undefined,
  embedded: unknown,
): LinkedArtwork[] {
  const out: LinkedArtwork[] = [];
  const seen = new Set<string>();
  const add = (a: unknown) => {
    const art = Array.isArray(a) ? a[0] : a;
    if (!art || typeof art !== 'object') return;
    const { id, title, image_url } = art as Partial<LinkedArtwork>;
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ id, title: title ?? '', image_url: image_url ?? null });
  };

  add(legacy);
  if (Array.isArray(embedded)) {
    for (const link of embedded) add((link as { artwork?: unknown } | null)?.artwork);
  }
  return out;
}

/** Unique, non-empty artwork ids from a single id plus an optional list, order preserved. */
export function uniqueArtworkIds(single?: string | null, many?: (string | null | undefined)[] | null): string[] {
  const ids: string[] = [];
  for (const raw of [single, ...(many ?? [])]) {
    const id = raw?.trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
