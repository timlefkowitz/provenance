import { describe, expect, it } from 'vitest';

import {
  formatTrialLength,
  getInstitutionInviteStatus,
  institutionInvitePath,
  institutionTrialEnd,
  isAllowedTrialDays,
  parseInviteEmails,
  shouldLockAccountToInstitution,
} from './institution-invites';

describe('parseInviteEmails', () => {
  it('splits on commas, semicolons, spaces and new lines', () => {
    const { valid, invalid } = parseInviteEmails(
      'a@museum.org, b@museum.org;c@museum.org\nd@museum.org  e@museum.org',
    );
    expect(valid).toEqual([
      'a@museum.org',
      'b@museum.org',
      'c@museum.org',
      'd@museum.org',
      'e@museum.org',
    ]);
    expect(invalid).toEqual([]);
  });

  it('lower-cases and de-duplicates', () => {
    expect(parseInviteEmails('Curator@Museum.org\ncurator@museum.org').valid).toEqual([
      'curator@museum.org',
    ]);
  });

  it('reads "Name <email>" entries pasted from a mail client', () => {
    expect(
      parseInviteEmails('Jane Doe <jane@museum.org>, "Sam Lee" <sam@museum.org>').valid,
    ).toEqual(['jane@museum.org', 'sam@museum.org']);
  });

  it('reports entries that are not emails', () => {
    const { valid, invalid } = parseInviteEmails('ok@museum.org, nope, also@bad');
    expect(valid).toEqual(['ok@museum.org']);
    expect(invalid).toEqual(['nope', 'also@bad']);
  });

  it('strips mailto:', () => {
    expect(parseInviteEmails('mailto:x@museum.org').valid).toEqual(['x@museum.org']);
  });
});

describe('trial helpers', () => {
  it('allows only the listed lengths', () => {
    expect(isAllowedTrialDays(90)).toBe(true);
    expect(isAllowedTrialDays(7)).toBe(false);
  });

  it('ends the trial trialDays after the start', () => {
    const start = new Date('2026-11-09T12:00:00Z');
    expect(institutionTrialEnd(start, 90).toISOString()).toBe('2027-02-07T12:00:00.000Z');
  });

  it('formats lengths for people', () => {
    expect(formatTrialLength(90)).toBe('3 months');
    expect(formatTrialLength(30)).toBe('1 month');
    expect(formatTrialLength(365)).toBe('1 year');
    expect(formatTrialLength(45)).toBe('45 days');
  });
});

describe('getInstitutionInviteStatus', () => {
  it('prefers accepted over revoked', () => {
    expect(getInstitutionInviteStatus({ accepted_at: 'x', revoked_at: 'y' })).toBe('accepted');
    expect(getInstitutionInviteStatus({ accepted_at: null, revoked_at: 'y' })).toBe('revoked');
    expect(getInstitutionInviteStatus({ accepted_at: null, revoked_at: null })).toBe('pending');
  });
});

describe('institutionInvitePath', () => {
  it('encodes the token', () => {
    expect(institutionInvitePath('a b')).toBe('/institution-invite?token=a%20b');
  });
});

describe('shouldLockAccountToInstitution', () => {
  it('locks new accounts and institution-only accounts', () => {
    expect(shouldLockAccountToInstitution([])).toBe(true);
    expect(shouldLockAccountToInstitution(['institution'])).toBe(true);
  });

  it('never locks someone who already has other profiles', () => {
    expect(shouldLockAccountToInstitution(['artist'])).toBe(false);
    expect(shouldLockAccountToInstitution(['institution', 'collector'])).toBe(false);
  });
});
