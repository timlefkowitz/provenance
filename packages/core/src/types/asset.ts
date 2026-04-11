import type { Planet } from './planet';

/**
 * Fields shared by all planet-specific asset tables.
 * Each planet extends this with domain-specific columns.
 */
export interface BaseAsset {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  certificate_number: string;
  certificate_status: string;
  provenance_history: unknown[];
  metadata: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface AssetEvent {
  id: string;
  planet: Planet;
  asset_id: string;
  event_type: AssetEventType;
  actor_id: string | null;
  payload: Record<string, unknown>;
  signature: string | null;
  created_at: string;
}

export type AssetEventType =
  | 'CREATED'
  | 'SOLD'
  | 'TRANSFERRED'
  | 'VERIFIED'
  | 'EXHIBITED'
  | 'SCANNED'
  | 'UPDATED'
  | 'REVOKED';

export interface Certificate {
  id: string;
  planet: Planet;
  asset_id: string;
  certificate_number: string;
  version: number;
  verification_score: number | null;
  status: 'active' | 'revoked' | 'updated';
  issued_at: string;
  issued_by: string | null;
  metadata: Record<string, unknown>;
}
