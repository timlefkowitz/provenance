/**
 * Collectible taxonomy for the main app.
 *
 * Mirrors `@provenance/planet-collectibles` so the main app (which does not
 * depend on that workspace package) can build the add/certificate UI without a
 * new dependency. Keep these in sync with packages/planet-collectibles.
 */

export const COLLECTIBLE_CATEGORIES = [
  'coins',
  'stamps',
  'trading-cards',
  'comics',
  'memorabilia',
  'toys',
  'watches',
  'jewelry',
  'wine',
  'antiques',
  'electronics',
  'instruments',
  'other',
] as const;

export type CollectibleCategory = (typeof COLLECTIBLE_CATEGORIES)[number];

export const COLLECTIBLE_CONDITIONS = [
  'mint',
  'near-mint',
  'excellent',
  'good',
  'fair',
  'poor',
] as const;

export type CollectibleCondition = (typeof COLLECTIBLE_CONDITIONS)[number];

export const GRADING_SERVICES = [
  'PSA',
  'CGC',
  'BGS',
  'PCGS',
  'NGC',
  'SGC',
  'GIA',
  'other',
] as const;

export type GradingService = (typeof GRADING_SERVICES)[number];

/** Human-friendly label for a category slug (e.g. "trading-cards" -> "Trading Cards"). */
export function formatCategoryLabel(category: string): string {
  return category
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Human-friendly label for a condition slug (e.g. "near-mint" -> "Near Mint"). */
export function formatConditionLabel(condition: string): string {
  return condition
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export interface CollectibleRow {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  manufacturer: string | null;
  year: number | null;
  condition: string | null;
  grading_service: string | null;
  grading_score: string | null;
  serial_number: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  certificate_number: string | null;
  certificate_status: string | null;
  provenance_history: unknown;
  metadata: Record<string, unknown> | null;
  status: string | null;
  is_public: boolean | null;
  value: string | null;
  value_is_public: boolean | null;
  created_at: string;
  updated_at?: string | null;
}
