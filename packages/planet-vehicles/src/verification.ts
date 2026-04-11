import type { PlanetVerificationAdapter, VerificationInput, VerificationResult } from '@provenance/verification-engine/types';
import { computeScore, isVerified, buildSources, detectRiskFlags } from '@provenance/verification-engine';
import type { VehicleVerificationContext } from './types/index';

export class VehicleVerificationAdapter implements PlanetVerificationAdapter {
  planet = 'vehicles' as const;

  async verify(input: VerificationInput): Promise<VerificationResult> {
    const ctx = input.metadata as unknown as VehicleVerificationContext;
    const vehicle = ctx.vehicle;

    const sources = buildSources({
      ownerVerified: ctx.ownerConfirmed,
      documentProvided: ctx.titleVerified,
    });

    if (ctx.vinValidated) {
      sources.push({
        type: 'vin_validated',
        label: 'VIN Validated',
        verified: true,
        weight: 0.35,
      });
    }

    if (ctx.titleVerified) {
      sources.push({
        type: 'title_verified',
        label: 'Title Verified',
        verified: true,
        weight: 0.30,
      });
    }

    const riskFlags = detectRiskFlags({
      ownershipGap: !ctx.provenanceComplete,
      unverifiedSource: !ctx.vinValidated,
      recentlyCreated: isRecentlyCreated(vehicle.created_at),
    });

    if (ctx.salvageHistory) {
      riskFlags.push({
        code: 'SALVAGE_HISTORY',
        severity: 'high',
        message: 'Vehicle has a salvage title in its history',
      });
    }

    if (!ctx.mileageConsistent) {
      riskFlags.push({
        code: 'MILEAGE_INCONSISTENCY',
        severity: 'high',
        message: 'Reported mileage is inconsistent with vehicle history records',
      });
    }

    const completeness = computeVehicleCompleteness(vehicle);

    const confidence = computeScore({
      chainIntegrity: ctx.provenanceComplete ? 1 : 0.3,
      trustedSourceRatio: sources.filter(s => s.verified).length / Math.max(sources.length, 1),
      uniqueness: ctx.vinValidated ? 1 : 0.5,
      completeness,
      anomalyCount: riskFlags.filter(f => f.severity === 'high' || f.severity === 'critical').length,
    });

    return {
      asset_id: input.asset_id,
      planet: 'vehicles',
      verified: isVerified(confidence),
      confidence: Math.round(confidence * 100) / 100,
      risk_flags: riskFlags,
      sources,
      computed_at: new Date().toISOString(),
    };
  }
}

function computeVehicleCompleteness(vehicle: VehicleVerificationContext['vehicle']): number {
  const fields = [
    vehicle.title,
    vehicle.vin,
    vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.mileage,
    vehicle.title_number,
    vehicle.image_url,
  ];
  const filled = fields.filter(Boolean).length;
  return filled / fields.length;
}

function isRecentlyCreated(createdAt: string): boolean {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() > thirtyDaysAgo;
}
