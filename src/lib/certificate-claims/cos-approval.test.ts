import { describe, expect, it } from 'vitest';

import {
  cosApprovingArtistId,
  resolveRequestReviewer,
  shouldIssueExhibitionCos,
  splitCosContentChanges,
} from './cos-approval';

const CURATOR = 'curator';
const ARTIST = 'artist';
const STRANGER = 'stranger';

describe('shouldIssueExhibitionCos', () => {
  const base = {
    ownerRole: 'artist',
    ownerAccountId: CURATOR,
    certificateType: 'authenticity',
    holderAccountId: ARTIST,
  };

  it("issues one for an artist's CoA in a curator show", () => {
    expect(shouldIssueExhibitionCos(base)).toBe(true);
  });

  it('issues one in gallery and institution shows', () => {
    expect(shouldIssueExhibitionCos({ ...base, ownerRole: 'gallery' })).toBe(true);
    expect(shouldIssueExhibitionCos({ ...base, ownerRole: 'institution' })).toBe(true);
  });

  it("doesn't issue one in a collector show", () => {
    expect(shouldIssueExhibitionCos({ ...base, ownerRole: 'collector' })).toBe(false);
  });

  it("doesn't issue one for the organiser's own work", () => {
    expect(shouldIssueExhibitionCos({ ...base, holderAccountId: CURATOR })).toBe(false);
  });

  it("doesn't issue one for a certificate that isn't a CoA", () => {
    expect(shouldIssueExhibitionCos({ ...base, certificateType: 'show' })).toBe(false);
    expect(shouldIssueExhibitionCos({ ...base, certificateType: 'ownership' })).toBe(false);
  });
});

describe('COS change approval', () => {
  const cos = { account_id: CURATOR, certificate_type: 'show', artist_account_id: ARTIST };

  it('names the artist as approver of a COS', () => {
    expect(cosApprovingArtistId(cos)).toBe(ARTIST);
  });

  it('has no approver for a CoA or an artist-less COS', () => {
    expect(cosApprovingArtistId({ ...cos, certificate_type: 'authenticity' })).toBeNull();
    expect(cosApprovingArtistId({ ...cos, artist_account_id: null })).toBeNull();
    expect(cosApprovingArtistId({ ...cos, artist_account_id: CURATOR })).toBeNull();
  });

  it("sends the holder's own COS change to the artist", () => {
    expect(
      resolveRequestReviewer({ artwork: cos, requestedBy: CURATOR, requesterCanEditCertificate: true }),
    ).toBe(ARTIST);
  });

  it("sends the artist's suggestion, and anyone else's, to the holder", () => {
    expect(
      resolveRequestReviewer({ artwork: cos, requestedBy: ARTIST, requesterCanEditCertificate: false }),
    ).toBe(CURATOR);
    expect(
      resolveRequestReviewer({ artwork: cos, requestedBy: STRANGER, requesterCanEditCertificate: false }),
    ).toBe(CURATOR);
  });

  it('sends requests on any other certificate to the holder', () => {
    expect(
      resolveRequestReviewer({
        artwork: { ...cos, certificate_type: 'authenticity' },
        requestedBy: STRANGER,
        requesterCanEditCertificate: false,
      }),
    ).toBe(CURATOR);
  });
});

describe('splitCosContentChanges', () => {
  const current = { title: 'Dusk', medium: 'Oil', creation_date: '2020-05-01T00:00:00Z', is_public: true };

  it('sends changed content to the artist and applies the rest', () => {
    const { requestFields, remaining } = splitCosContentChanges(
      { title: 'Dawn', medium: 'Oil', isPublic: false, exhibitionId: 'x' },
      current,
    );
    expect(requestFields).toEqual({ title: 'Dawn' });
    expect(remaining).toEqual({ isPublic: false, exhibitionId: 'x' });
  });

  it('treats an unchanged date as unchanged', () => {
    expect(splitCosContentChanges({ creationDate: '2020-05-01' }, current).requestFields).toEqual({});
  });

  it('maps field names to change-request columns', () => {
    expect(
      splitCosContentChanges({ formerOwners: 'A; B', creationDate: '2021-01-01' }, current).requestFields,
    ).toEqual({ former_owners: 'A; B', creation_date: '2021-01-01' });
  });
});
