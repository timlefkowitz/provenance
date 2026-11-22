/**
 * Accounts owned by the company itself (Tim's account, which holds the
 * Provenance and FL!GHT gallery profiles). Buyers already pay into the
 * company's Stripe balance, so money these accounts earn stays there: no
 * seller earning is booked, nothing is transferred and no payout email goes
 * out. The sale and the order's split are still recorded.
 *
 * Add more with the HOUSE_ACCOUNT_IDS env var (comma-separated account ids).
 */
const BUILT_IN_HOUSE_ACCOUNT_IDS = ['28f3c8e1-2d0f-4b3d-8902-77f9453a83f1'];

export function houseAccountIds(raw: string | undefined = process.env.HOUSE_ACCOUNT_IDS): Set<string> {
  const extra = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...BUILT_IN_HOUSE_ACCOUNT_IDS, ...extra]);
}

export function isHouseAccount(accountId: string | null | undefined, ids: Set<string> = houseAccountIds()): boolean {
  return !!accountId && ids.has(accountId);
}
