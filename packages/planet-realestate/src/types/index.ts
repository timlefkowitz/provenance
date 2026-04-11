import type { BaseAsset } from '@provenance/core/types';

export interface Property extends BaseAsset {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  parcel_number: string | null;
  property_type: PropertyType | null;
  lot_size: string | null;
  building_size: string | null;
  year_built: number | null;
  deed_type: string | null;
}

export type PropertyType = 'residential' | 'commercial' | 'land' | 'industrial' | 'mixed-use';

export const PROPERTY_TYPES: PropertyType[] = [
  'residential',
  'commercial',
  'land',
  'industrial',
  'mixed-use',
];

export const DEED_TYPES = [
  'warranty',
  'quitclaim',
  'grant',
  'bargain-and-sale',
  'special-warranty',
  'other',
] as const;

export type DeedType = (typeof DEED_TYPES)[number];

export interface PropertyCreateInput {
  title: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  parcel_number?: string;
  property_type?: PropertyType;
  lot_size?: string;
  building_size?: string;
  year_built?: number;
  deed_type?: string;
  description?: string;
  image_url?: string;
}

export interface PropertyVerificationContext {
  property: Property;
  deedVerified: boolean;
  parcelValidated: boolean;
  ownerConfirmed: boolean;
  titleClear: boolean;
  provenanceComplete: boolean;
}
