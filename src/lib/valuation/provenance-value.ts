/**
 * Provenance Value: the artist's own price plus premiums for a documented
 * history. Shown next to (never in place of) the artist's Value.
 */

export const EXHIBITION_PREMIUM = 0.1;
export const PUBLICATION_PREMIUM = 0.05;

export type ArtworkPublication = {
  title: string;
  publication_name?: string | null;
  url?: string | null;
  date?: string | null;
};

export type ProvenancePremium = { label: string; rate: number };

export type ProvenanceValue = {
  /** Artist's price, parsed from the free-text value. */
  base: number;
  total: number;
  /** Symbol or code the artist wrote ("$", "€", "USD"...), reused when formatting. */
  currency: { symbol: string | null; code: string | null };
  premiums: ProvenancePremium[];
};

const SYMBOLS = ['$', '€', '£', '¥'];
const CODES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'MXN'];

/**
 * Parse an artist-entered price such as "$4,500", "4500 USD", "€12.000" or
 * "$2.5k". Returns null for ranges, "NFS", "POA" and other non-prices.
 */
export function parseArtworkPrice(
  raw: string | null | undefined,
): { amount: number; symbol: string | null; code: string | null } | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  // A range ("$3,000 - $5,000") or several numbers has no single price.
  const numbers = text.match(/\d[\d.,]*/g);
  if (!numbers || numbers.length !== 1) return null;

  const symbol = SYMBOLS.find((s) => text.includes(s)) ?? null;
  const upper = text.toUpperCase();
  const code = CODES.find((c) => new RegExp(`\\b${c}\\b`).test(upper)) ?? null;

  let digits = numbers[0]!;
  // "12.000" / "12,000" (thousands) vs "12.50" / "12,50" (decimals).
  const lastSep = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','));
  if (lastSep >= 0 && digits.length - lastSep - 1 === 3) {
    digits = digits.replace(/[.,]/g, '');
  } else if (lastSep >= 0) {
    digits = digits.slice(0, lastSep).replace(/[.,]/g, '') + '.' + digits.slice(lastSep + 1);
  }

  let amount = Number(digits);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const suffix = text.slice(text.indexOf(numbers[0]!) + numbers[0]!.length).trim().toLowerCase();
  if (/^k\b/.test(suffix)) amount *= 1_000;
  else if (/^(m|mm)\b/.test(suffix)) amount *= 1_000_000;

  return { amount, symbol, code };
}

export function computeProvenanceValue(input: {
  value: string | null | undefined;
  exhibitionCount: number;
  publicationCount: number;
}): ProvenanceValue | null {
  const price = parseArtworkPrice(input.value);
  if (!price) return null;

  const premiums: ProvenancePremium[] = [];
  if (input.exhibitionCount > 0) premiums.push({ label: 'Exhibited', rate: EXHIBITION_PREMIUM });
  if (input.publicationCount > 0) premiums.push({ label: 'Published', rate: PUBLICATION_PREMIUM });
  if (premiums.length === 0) return null;

  const rate = premiums.reduce((sum, p) => sum + p.rate, 0);
  return {
    base: price.amount,
    total: Math.round(price.amount * (1 + rate) * 100) / 100,
    currency: { symbol: price.symbol, code: price.code },
    premiums,
  };
}

export function formatProvenanceAmount(
  amount: number,
  currency: ProvenanceValue['currency'],
): string {
  const n = amount.toLocaleString('en-US', {
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  });
  if (currency.symbol) return `${currency.symbol}${n}${currency.code ? ` ${currency.code}` : ''}`;
  if (currency.code) return `${n} ${currency.code}`;
  return n;
}

/** Keep only well-formed entries; used on read and before save. */
export function sanitizePublications(raw: unknown): ArtworkPublication[] {
  if (!Array.isArray(raw)) return [];
  const clip = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
  const out: ArtworkPublication[] = [];
  for (const item of raw.slice(0, 50)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const title = clip(r.title, 300);
    if (!title) continue;
    let url = clip(r.url, 1000);
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    out.push({
      title,
      publication_name: clip(r.publication_name, 200),
      url,
      date: clip(r.date, 40),
    });
  }
  return out;
}
