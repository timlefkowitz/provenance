import type { PlanetVerificationAdapter, VerificationInput, VerificationResult } from '@provenance/verification-engine/types';
import { computeScore, isVerified, buildSources, detectRiskFlags } from '@provenance/verification-engine';
import type { CollectibleVerificationContext } from './types/index';

export class CollectibleVerificationAdapter implements PlanetVerificationAdapter {
  planet = 'collectibles' as const;

  async verify(input: VerificationInput): Promise<VerificationResult> {
    const ctx = input.metadata as unknown as CollectibleVerificationContext;
    const collectible = ctx.collectible;

    const sources = buildSources({
      ownerVerified: ctx.ownerConfirmed,
      documentProvided: ctx.gradingVerified,
    });

    if (ctx.serialNumberValidated) {
      sources.push({
        type: 'serial_number_validated',
        label: 'Serial Number Validated',
        verified: true,
        weight: 0.25,
      });
    }

    if (ctx.gradingVerified) {
      sources.push({
        type: 'grading_verified',
        label: `Grading Verified (${collectible.grading_service ?? 'unknown'})`,
        verified: true,
        weight: 0.30,
      });
    }

    const riskFlags = detectRiskFlags({
      duplicateImageDetected: ctx.duplicateDetected,
      ownershipGap: !ctx.provenanceComplete,
      unverifiedSource: !ctx.gradingVerified,
      recentlyCreated: isRecentlyCreated(collectible.created_at),
    });

    const completeness = computeCollectibleCompleteness(collectible);

    const confidence = computeScore({
      chainIntegrity: ctx.provenanceComplete ? 1 : 0.3,
      trustedSourceRatio: sources.filter(s => s.verified).length / Math.max(sources.length, 1),
      uniqueness: ctx.duplicateDetected ? 0.2 : 1,
      completeness,
      anomalyCount: riskFlags.filter(f => f.severity === 'high' || f.severity === 'critical').length,
    });

    return {
      asset_id: input.asset_id,
      planet: 'collectibles',
      verified: isVerified(confidence),
      confidence: Math.round(confidence * 100) / 100,
      risk_flags: riskFlags,
      sources,
      computed_at: new Date().toISOString(),
    };
  }
}

function computeCollectibleCompleteness(collectible: CollectibleVerificationContext['collectible']): number {
  const fields = [
    collectible.title,
    collectible.category,
    collectible.manufacturer,
    collectible.year,
    collectible.condition,
    collectible.serial_number,
    collectible.image_url,
    collectible.description,
  ];
  const filled = fields.filter(Boolean).length;
  return filled / fields.length;
}

function isRecentlyCreated(createdAt: string): boolean {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() > thirtyDaysAgo;
}
