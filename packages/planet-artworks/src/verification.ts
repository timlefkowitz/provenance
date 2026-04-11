import type { PlanetVerificationAdapter, VerificationInput, VerificationResult } from '@provenance/verification-engine/types';
import { computeScore, isVerified, buildSources, detectRiskFlags } from '@provenance/verification-engine';
import type { ArtworkVerificationContext } from './types/index';

export class ArtworkVerificationAdapter implements PlanetVerificationAdapter {
  planet = 'artworks' as const;

  async verify(input: VerificationInput): Promise<VerificationResult> {
    const ctx = input.metadata as unknown as ArtworkVerificationContext;
    const artwork = ctx.artwork;

    const sources = buildSources({
      artistSigned: ctx.artistConfirmed,
      ownerVerified: ctx.ownerConfirmed,
      galleryVerified: ctx.galleryAttached,
      documentProvided: ctx.provenanceComplete,
    });

    const riskFlags = detectRiskFlags({
      duplicateImageDetected: ctx.duplicateImageDetected,
      ownershipGap: !ctx.provenanceComplete,
      unverifiedSource: !ctx.artistConfirmed && !ctx.galleryAttached,
      recentlyCreated: isRecentlyCreated(artwork.created_at),
    });

    const completeness = computeArtworkCompleteness(artwork);

    const confidence = computeScore({
      chainIntegrity: ctx.provenanceComplete ? 1 : 0.3,
      trustedSourceRatio: sources.filter(s => s.verified).length / Math.max(sources.length, 1),
      uniqueness: ctx.duplicateImageDetected ? 0.2 : 1,
      completeness,
      anomalyCount: riskFlags.filter(f => f.severity === 'high' || f.severity === 'critical').length,
    });

    return {
      asset_id: input.asset_id,
      planet: 'artworks',
      verified: isVerified(confidence),
      confidence: Math.round(confidence * 100) / 100,
      risk_flags: riskFlags,
      sources,
      computed_at: new Date().toISOString(),
    };
  }
}

function computeArtworkCompleteness(artwork: ArtworkVerificationContext['artwork']): number {
  const fields = [
    artwork.title,
    artwork.artist_name,
    artwork.medium,
    artwork.dimensions,
    artwork.creation_date,
    artwork.description,
    artwork.image_url,
    artwork.former_owners,
  ];
  const filled = fields.filter(Boolean).length;
  return filled / fields.length;
}

function isRecentlyCreated(createdAt: string): boolean {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() > thirtyDaysAgo;
}
