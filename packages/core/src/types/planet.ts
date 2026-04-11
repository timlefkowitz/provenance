export const PLANETS = ['artworks', 'collectibles', 'realestate', 'vehicles'] as const;

export type Planet = (typeof PLANETS)[number];

export interface PlanetConfig {
  id: Planet;
  label: string;
  subdomain: string;
  description: string;
}

export const PLANET_CONFIGS: Record<Planet, PlanetConfig> = {
  artworks: {
    id: 'artworks',
    label: 'Artworks',
    subdomain: 'provenance.guru',
    description: 'Art provenance, certificates of authenticity, and artist verification',
  },
  collectibles: {
    id: 'collectibles',
    label: 'Collectibles',
    subdomain: 'collc.provenance.guru',
    description: 'Collectible authentication, grading verification, and ownership tracking',
  },
  realestate: {
    id: 'realestate',
    label: 'Real Estate',
    subdomain: 'rest.provenance.guru',
    description: 'Property provenance, deed history, and title verification',
  },
  vehicles: {
    id: 'vehicles',
    label: 'Vehicles',
    subdomain: 'auto.provenance.guru',
    description: 'Vehicle history, VIN verification, and ownership chain tracking',
  },
};

export function isValidPlanet(value: string): value is Planet {
  return PLANETS.includes(value as Planet);
}

export function getPlanetFromHost(host: string): Planet {
  if (host.startsWith('collc.')) return 'collectibles';
  if (host.startsWith('rest.')) return 'realestate';
  if (host.startsWith('auto.')) return 'vehicles';
  return 'artworks';
}

export function getPlanetFromEnv(): Planet {
  const envPlanet = process.env.NEXT_PUBLIC_PLANET ?? process.env.NEXT_PUBLIC_ISLAND;
  if (envPlanet && isValidPlanet(envPlanet)) return envPlanet;
  return 'artworks';
}
