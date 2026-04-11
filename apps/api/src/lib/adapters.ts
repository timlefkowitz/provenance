import type { Planet } from '@provenance/core/types';
import type { PlanetVerificationAdapter } from '@provenance/verification-engine/types';
import { ArtworkVerificationAdapter } from '@provenance/planet-artworks';
import { CollectibleVerificationAdapter } from '@provenance/planet-collectibles';
import { PropertyVerificationAdapter } from '@provenance/planet-realestate';
import { VehicleVerificationAdapter } from '@provenance/planet-vehicles';

const adapters: Record<Planet, PlanetVerificationAdapter> = {
  artworks: new ArtworkVerificationAdapter(),
  collectibles: new CollectibleVerificationAdapter(),
  realestate: new PropertyVerificationAdapter(),
  vehicles: new VehicleVerificationAdapter(),
};

export function getVerificationAdapter(planet: Planet): PlanetVerificationAdapter {
  return adapters[planet];
}

/**
 * Maps planet identifiers to their corresponding database table.
 */
export function getTableForPlanet(planet: Planet): string {
  const tables: Record<Planet, string> = {
    artworks: 'artworks',
    collectibles: 'collectibles',
    realestate: 'properties',
    vehicles: 'vehicles',
  };
  return tables[planet];
}
