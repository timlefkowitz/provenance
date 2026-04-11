import type { Planet } from '@provenance/core/types';

export interface VerificationInput {
  planet: Planet;
  asset_id: string;
  metadata: Record<string, unknown>;
}

export interface VerificationResult {
  asset_id: string;
  planet: Planet;
  verified: boolean;
  confidence: number;
  risk_flags: RiskFlag[];
  sources: VerificationSource[];
  certificate_id?: string;
  computed_at: string;
}

export interface RiskFlag {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface VerificationSource {
  type: string;
  label: string;
  verified: boolean;
  weight: number;
}

export interface ScoringWeights {
  ownership_chain: number;
  trusted_sources: number;
  uniqueness: number;
  completeness: number;
  anomaly_penalty: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  ownership_chain: 0.25,
  trusted_sources: 0.25,
  uniqueness: 0.20,
  completeness: 0.20,
  anomaly_penalty: 0.10,
};

/**
 * Planet-specific verification adapters implement this interface.
 * The unified API gateway delegates to the correct adapter based on the planet.
 */
export interface PlanetVerificationAdapter {
  planet: Planet;
  verify(input: VerificationInput): Promise<VerificationResult>;
}
