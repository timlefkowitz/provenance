/**
 * One work in a cart. exhibitionId is the show it is bought through (the
 * gallery's commission applies); null for a work its holder sells directly.
 * Prices are never trusted from the browser.
 */
export type CartLine = { artworkId: string; exhibitionId: string | null };

export const MAX_CART_ITEMS = 25;

export function mergeCartLines(a: CartLine[], b: CartLine[]): CartLine[] {
  const seen = new Set<string>();
  const out: CartLine[] = [];
  for (const l of [...a, ...b]) {
    if (!l?.artworkId || seen.has(l.artworkId)) continue;
    seen.add(l.artworkId);
    out.push({ artworkId: l.artworkId, exhibitionId: l.exhibitionId || null });
  }
  return out.slice(0, MAX_CART_ITEMS);
}
