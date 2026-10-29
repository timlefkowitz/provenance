import { describe, expect, it } from 'vitest';

import {
  canAccountActAs,
  getAllowedRolesForAccount,
  isInstitutionAccount,
} from './institution-account';
import { ALL_USER_ROLES, USER_ROLES, isTeamProfileRole } from './user-roles';

const locked = { account_type: 'institution', role: 'institution' };
const individualInInstitutionMode = { role: 'institution' };

describe('isInstitutionAccount', () => {
  it('is true only when an admin set account_type', () => {
    expect(isInstitutionAccount(locked)).toBe(true);
    expect(isInstitutionAccount(individualInInstitutionMode)).toBe(false);
    expect(isInstitutionAccount({ account_type: 'gallery' })).toBe(false);
    expect(isInstitutionAccount(null)).toBe(false);
    expect(isInstitutionAccount(undefined)).toBe(false);
  });
});

describe('canAccountActAs', () => {
  it('lets a locked institution account act only as the institution', () => {
    expect(canAccountActAs(locked, USER_ROLES.INSTITUTION)).toBe(true);
    for (const role of [USER_ROLES.ARTIST, USER_ROLES.COLLECTOR, USER_ROLES.GALLERY]) {
      expect(canAccountActAs(locked, role)).toBe(false);
    }
    expect(canAccountActAs(locked, null)).toBe(false);
  });

  it('leaves individual accounts, including staff in institution mode, free to switch', () => {
    for (const role of ALL_USER_ROLES) {
      expect(canAccountActAs(individualInInstitutionMode, role)).toBe(true);
      expect(canAccountActAs(null, role)).toBe(true);
    }
  });
});

describe('getAllowedRolesForAccount', () => {
  it('returns only institution for a locked account', () => {
    expect(getAllowedRolesForAccount(locked)).toEqual([USER_ROLES.INSTITUTION]);
  });

  it('returns every role for an individual account', () => {
    expect(getAllowedRolesForAccount(individualInInstitutionMode)).toEqual(ALL_USER_ROLES);
  });
});

describe('isTeamProfileRole', () => {
  it('covers gallery and institution profiles only', () => {
    expect(isTeamProfileRole(USER_ROLES.GALLERY)).toBe(true);
    expect(isTeamProfileRole(USER_ROLES.INSTITUTION)).toBe(true);
    expect(isTeamProfileRole(USER_ROLES.ARTIST)).toBe(false);
    expect(isTeamProfileRole(USER_ROLES.COLLECTOR)).toBe(false);
    expect(isTeamProfileRole(null)).toBe(false);
  });
});
