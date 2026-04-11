import type { PlanetVerificationAdapter, VerificationInput, VerificationResult } from '@provenance/verification-engine/types';
import { computeScore, isVerified, buildSources, detectRiskFlags } from '@provenance/verification-engine';
import type { PropertyVerificationContext } from './types/index';

export class PropertyVerificationAdapter implements PlanetVerificationAdapter {
  planet = 'realestate' as const;

  async verify(input: VerificationInput): Promise<VerificationResult> {
    const ctx = input.metadata as unknown as PropertyVerificationContext;
    const property = ctx.property;

    const sources = buildSources({
      ownerVerified: ctx.ownerConfirmed,
      documentProvided: ctx.deedVerified,
    });

    if (ctx.parcelValidated) {
      sources.push({
        type: 'parcel_validated',
        label: 'Parcel Number Validated',
        verified: true,
        weight: 0.25,
      });
    }

    if (ctx.titleClear) {
      sources.push({
        type: 'title_clear',
        label: 'Title Clear',
        verified: true,
        weight: 0.30,
      });
    }

    if (ctx.deedVerified) {
      sources.push({
        type: 'deed_verified',
        label: 'Deed Verified',
        verified: true,
        weight: 0.30,
      });
    }

    const riskFlags = detectRiskFlags({
      ownershipGap: !ctx.provenanceComplete,
      unverifiedSource: !ctx.deedVerified,
      recentlyCreated: isRecentlyCreated(property.created_at),
    });

    if (!ctx.titleClear) {
      riskFlags.push({
        code: 'TITLE_NOT_CLEAR',
        severity: 'high',
        message: 'Property title has not been confirmed as clear of liens or encumbrances',
      });
    }

    const completeness = computePropertyCompleteness(property);

    const confidence = computeScore({
      chainIntegrity: ctx.provenanceComplete ? 1 : 0.3,
      trustedSourceRatio: sources.filter(s => s.verified).length / Math.max(sources.length, 1),
      uniqueness: 1, // properties are inherently unique by parcel
      completeness,
      anomalyCount: riskFlags.filter(f => f.severity === 'high' || f.severity === 'critical').length,
    });

    return {
      asset_id: input.asset_id,
      planet: 'realestate',
      verified: isVerified(confidence),
      confidence: Math.round(confidence * 100) / 100,
      risk_flags: riskFlags,
      sources,
      computed_at: new Date().toISOString(),
    };
  }
}

function computePropertyCompleteness(property: PropertyVerificationContext['property']): number {
  const fields = [
    property.title,
    property.address,
    property.city,
    property.state,
    property.parcel_number,
    property.property_type,
    property.deed_type,
    property.image_url,
  ];
  const filled = fields.filter(Boolean).length;
  return filled / fields.length;
}

function isRecentlyCreated(createdAt: string): boolean {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() > thirtyDaysAgo;
}
