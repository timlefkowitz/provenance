export type PersonaLandingSlug =
  | 'artist'
  | 'collector'
  | 'gallery'
  | 'institution';

/**
 * Maps marketing subdomains → `/lp/*` routes.
 * Configure DNS so each hostname points at the same Next.js deployment.
 *
 * Expected hosts (production):
 * - artist.provenance.guru
 * - collector.provenance.guru
 * - gallerys.provenance.guru (also accepts galleries.*)
 * - int.provenance.guru (also accepts institutions.*)
 */
export function getPersonaSlugFromHost(host: string): PersonaLandingSlug | null {
  const hostname = host.split(':')[0]?.toLowerCase() ?? '';

  if (hostname.startsWith('artist.')) {
    return 'artist';
  }

  if (hostname.startsWith('collector.')) {
    return 'collector';
  }

  if (hostname.startsWith('gallerys.') || hostname.startsWith('galleries.')) {
    return 'gallery';
  }

  if (
    hostname.startsWith('int.') ||
    hostname.startsWith('institutions.') ||
    hostname.startsWith('institution.')
  ) {
    return 'institution';
  }

  return null;
}
