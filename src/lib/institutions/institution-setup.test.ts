import { describe, expect, it } from 'vitest';

import {
  canEditInstitutionSetup,
  institutionSetupPath,
  isHiddenFromPublic,
  shouldMakeExistingWorksPrivate,
} from './institution-setup';

describe('canEditInstitutionSetup', () => {
  it('lets owners and admins edit, and keeps members read-only', () => {
    expect(canEditInstitutionSetup('owner')).toBe(true);
    expect(canEditInstitutionSetup('admin')).toBe(true);
    expect(canEditInstitutionSetup('member')).toBe(false);
    expect(canEditInstitutionSetup(null)).toBe(false);
  });
});

describe('shouldMakeExistingWorksPrivate', () => {
  it('only hides existing works when the setting is switched on', () => {
    expect(shouldMakeExistingWorksPrivate(false, true)).toBe(true);
    expect(shouldMakeExistingWorksPrivate(true, true)).toBe(false);
    expect(shouldMakeExistingWorksPrivate(true, false)).toBe(false);
    expect(shouldMakeExistingWorksPrivate(false, false)).toBe(false);
  });
});

describe('isHiddenFromPublic', () => {
  it('treats only an explicit true as private', () => {
    expect(isHiddenFromPublic({ is_private: true })).toBe(true);
    expect(isHiddenFromPublic({ is_private: false })).toBe(false);
    expect(isHiddenFromPublic({ is_private: null })).toBe(false);
    expect(isHiddenFromPublic({})).toBe(false);
  });
});

it('builds the setup path', () => {
  expect(institutionSetupPath('abc')).toBe('/profiles/abc/setup');
});
