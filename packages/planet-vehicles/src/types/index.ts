import type { BaseAsset } from '@provenance/core/types';

export interface Vehicle extends BaseAsset {
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  mileage: number | null;
  engine: string | null;
  transmission: VehicleTransmission | null;
  title_number: string | null;
  title_state: string | null;
}

export type VehicleTransmission = 'automatic' | 'manual' | 'cvt' | 'dct' | 'other';

export const VEHICLE_TRANSMISSIONS: VehicleTransmission[] = [
  'automatic',
  'manual',
  'cvt',
  'dct',
  'other',
];

export interface VehicleCreateInput {
  title: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  mileage?: number;
  engine?: string;
  transmission?: VehicleTransmission;
  title_number?: string;
  title_state?: string;
  description?: string;
  image_url?: string;
}

export interface VehicleVerificationContext {
  vehicle: Vehicle;
  vinValidated: boolean;
  titleVerified: boolean;
  ownerConfirmed: boolean;
  mileageConsistent: boolean;
  provenanceComplete: boolean;
  salvageHistory: boolean;
}
