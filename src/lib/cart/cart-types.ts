/** One work in a cart. Prices are never trusted from the browser. */
export type CartLine = { artworkId: string; exhibitionId: string };

export const MAX_CART_ITEMS = 25;

export function mergeCartLines(a: CartLine[], b: CartLine[]): CartLine[] {
  const seen = new Set<string>();
  const out: CartLine[] = [];
  for (const l of [...a, ...b]) {
    if (!l?.artworkId || !l?.exhibitionId || seen.has(l.artworkId)) continue;
    seen.add(l.artworkId);
    out.push({ artworkId: l.artworkId, exhibitionId: l.exhibitionId });
  }
  return out.slice(0, MAX_CART_ITEMS);
}
