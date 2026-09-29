import { describe, expect, it } from 'vitest';

import { certificatePathFromScan } from './certificate-scan';

const ID = '3f2b8c1e-9a4d-4e21-8b7a-1c2d3e4f5a6b';

describe('certificatePathFromScan', () => {
  it('opens artwork and collectible certificates as recorded scans', () => {
    expect(certificatePathFromScan(`https://www.provenance.guru/artworks/${ID}/certificate`)).toBe(
      `/artworks/${ID}/certificate?scan=true`,
    );
    expect(certificatePathFromScan(`https://provenance.guru/collectibles/${ID}/certificate?scan=true`)).toBe(
      `/collectibles/${ID}/certificate?scan=true`,
    );
  });

  it('opens other Provenance links as-is', () => {
    expect(certificatePathFromScan('https://www.provenance.guru/registry?q=a')).toBe('/registry?q=a');
  });

  it('rejects non-Provenance and non-URL codes', () => {
    expect(certificatePathFromScan('https://evil.example/artworks/x/certificate')).toBeNull();
    expect(certificatePathFromScan('https://provenance.guru.evil.example/')).toBeNull();
    expect(certificatePathFromScan('http://www.provenance.guru/')).toBeNull();
    expect(certificatePathFromScan('WIFI:S:home;T:WPA;P:secret;;')).toBeNull();
  });
});
