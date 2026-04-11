import type { BaseAsset } from '@provenance/core/types';

export interface Collectible extends BaseAsset {
  category: string | null;
  subcategory: string | null;
  manufacturer: string | null;
  year: number | null;
  condition: CollectibleCondition | null;
  grading_service: string | null;
  grading_score: string | null;
  serial_number: string | null;
}

export type CollectibleCondition = 'mint' | 'near-mint' | 'excellent' | 'good' | 'fair' | 'poor';

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
  'other',
] as const;

export type CollectibleCategory = (typeof COLLECTIBLE_CATEGORIES)[number];

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

export interface CollectibleCreateInput {
  title: string;
  category?: string;
  subcategory?: string;
  manufacturer?: string;
  year?: number;
  condition?: CollectibleCondition;
  grading_service?: string;
  grading_score?: string;
  serial_number?: string;
  description?: string;
  image_url?: string;
}

export interface CollectibleVerificationContext {
  collectible: Collectible;
  gradingVerified: boolean;
  serialNumberValidated: boolean;
  ownerConfirmed: boolean;
  provenanceComplete: boolean;
  duplicateDetected: boolean;
}
