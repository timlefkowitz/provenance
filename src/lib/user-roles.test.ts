import { describe, expect, it } from 'vitest';

import {
  CERTIFICATE_TYPES,
  USER_ROLES,
  getCertificateTypeForRole,
  getInitialCertificateStatus,
  posterRequiresArtistClaim,
} from './user-roles';

describe('getInitialCertificateStatus', () => {
  it('waits for the artist to claim gallery and institution posts', () => {
    expect(getInitialCertificateStatus(USER_ROLES.GALLERY)).toBe('pending_artist_claim');
    expect(getInitialCertificateStatus(USER_ROLES.INSTITUTION)).toBe('pending_artist_claim');
  });

  it('verifies artist and collector posts immediately', () => {
    expect(getInitialCertificateStatus(USER_ROLES.ARTIST)).toBe('verified');
    expect(getInitialCertificateStatus(USER_ROLES.COLLECTOR)).toBe('verified');
  });

  it('verifies posts from accounts with no role, matching the artist default', () => {
    expect(getInitialCertificateStatus(null)).toBe('verified');
  });
});

describe('posterRequiresArtistClaim', () => {
  it('matches the roles that issue a Certificate of Show', () => {
    for (const role of [USER_ROLES.GALLERY, USER_ROLES.INSTITUTION]) {
      expect(getCertificateTypeForRole(role)).toBe(CERTIFICATE_TYPES.SHOW);
      expect(posterRequiresArtistClaim(role)).toBe(true);
    }
    for (const role of [USER_ROLES.ARTIST, USER_ROLES.COLLECTOR]) {
      expect(getCertificateTypeForRole(role)).not.toBe(CERTIFICATE_TYPES.SHOW);
      expect(posterRequiresArtistClaim(role)).toBe(false);
    }
  });
});
