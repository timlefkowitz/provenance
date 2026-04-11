import type {
  ScoringWeights,
  VerificationSource,
  RiskFlag,
} from './types';
import { DEFAULT_SCORING_WEIGHTS } from './types';

export interface ScoreInputs {
  /** 0–1: how complete is the ownership chain */
  chainIntegrity: number;
  /** 0–1: ratio of trusted/verified sources */
  trustedSourceRatio: number;
  /** 0–1: uniqueness score (1 = no duplicates found) */
  uniqueness: number;
  /** 0–1: how complete is the asset metadata */
  completeness: number;
  /** Count of anomalies detected */
  anomalyCount: number;
}

/**
 * Core scoring function shared across all planets.
 *
 * score = (chain_weight * chain_integrity)
 *       + (source_weight * trusted_sources)
 *       + (unique_weight * uniqueness_score)
 *       + (complete_weight * completeness)
 *       - (risk_weight * anomaly_ratio)
 */
export function computeScore(
  inputs: ScoreInputs,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): number {
  const anomalyRatio = Math.min(inputs.anomalyCount / 5, 1);

  const raw =
    weights.ownership_chain * inputs.chainIntegrity +
    weights.trusted_sources * inputs.trustedSourceRatio +
    weights.uniqueness * inputs.uniqueness +
    weights.completeness * inputs.completeness -
    weights.anomaly_penalty * anomalyRatio;

  return Math.max(0, Math.min(1, raw));
}

/**
 * Determines verified status from a confidence score.
 * Assets scoring >= 0.70 are considered verified.
 */
export function isVerified(confidence: number): boolean {
  return confidence >= 0.70;
}

/**
 * Builds a list of verification sources from boolean checks.
 */
export function buildSources(checks: {
  artistSigned?: boolean;
  ownerVerified?: boolean;
  galleryVerified?: boolean;
  documentProvided?: boolean;
  imageFingerprinted?: boolean;
}): VerificationSource[] {
  const sources: VerificationSource[] = [];

  if (checks.artistSigned !== undefined) {
    sources.push({
      type: 'artist_signed',
      label: 'Artist Signed',
      verified: checks.artistSigned,
      weight: 0.30,
    });
  }

  if (checks.ownerVerified !== undefined) {
    sources.push({
      type: 'owner_verified',
      label: 'Owner Verified',
      verified: checks.ownerVerified,
      weight: 0.25,
    });
  }

  if (checks.galleryVerified !== undefined) {
    sources.push({
      type: 'gallery_verified',
      label: 'Gallery Verified',
      verified: checks.galleryVerified,
      weight: 0.25,
    });
  }

  if (checks.documentProvided !== undefined) {
    sources.push({
      type: 'document_provided',
      label: 'Documentation Provided',
      verified: checks.documentProvided,
      weight: 0.10,
    });
  }

  if (checks.imageFingerprinted !== undefined) {
    sources.push({
      type: 'image_fingerprinted',
      label: 'Image Fingerprinted',
      verified: checks.imageFingerprinted,
      weight: 0.10,
    });
  }

  return sources;
}

/**
 * Generates risk flags from common anomaly checks.
 */
export function detectRiskFlags(checks: {
  duplicateImageDetected?: boolean;
  ownershipGap?: boolean;
  metadataInconsistency?: boolean;
  unverifiedSource?: boolean;
  recentlyCreated?: boolean;
}): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (checks.duplicateImageDetected) {
    flags.push({
      code: 'DUPLICATE_IMAGE',
      severity: 'high',
      message: 'A duplicate or near-duplicate image was detected in the system',
    });
  }

  if (checks.ownershipGap) {
    flags.push({
      code: 'OWNERSHIP_GAP',
      severity: 'medium',
      message: 'There is a gap in the ownership chain history',
    });
  }

  if (checks.metadataInconsistency) {
    flags.push({
      code: 'METADATA_INCONSISTENCY',
      severity: 'medium',
      message: 'Asset metadata contains inconsistent or conflicting information',
    });
  }

  if (checks.unverifiedSource) {
    flags.push({
      code: 'UNVERIFIED_SOURCE',
      severity: 'low',
      message: 'One or more provenance sources have not been independently verified',
    });
  }

  if (checks.recentlyCreated) {
    flags.push({
      code: 'RECENTLY_CREATED',
      severity: 'low',
      message: 'Asset was registered recently and has limited verification history',
    });
  }

  return flags;
}
