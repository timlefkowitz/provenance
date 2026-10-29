import { describe, expect, it } from 'vitest';

import { USER_ROLES } from '~/lib/user-roles';
import {
  canOwnExhibitionAs,
  defaultExhibitionOwnerRole,
  getExhibitionOwnerRoleOptions,
} from './exhibition-owner-roles';

describe('exhibition owner roles for a locked institution account', () => {
  it('only offers the institution', () => {
    expect(getExhibitionOwnerRoleOptions(USER_ROLES.INSTITUTION, true)).toEqual([
      USER_ROLES.INSTITUTION,
    ]);
  });

  it('refuses artist and gallery owned shows', () => {
    expect(canOwnExhibitionAs(USER_ROLES.ARTIST, USER_ROLES.INSTITUTION, true)).toBe(false);
    expect(canOwnExhibitionAs(USER_ROLES.GALLERY, USER_ROLES.INSTITUTION, true)).toBe(false);
    expect(canOwnExhibitionAs(USER_ROLES.INSTITUTION, USER_ROLES.INSTITUTION, true)).toBe(true);
  });

  it('defaults to the institution even when another owner is requested', () => {
    expect(defaultExhibitionOwnerRole(USER_ROLES.INSTITUTION, USER_ROLES.ARTIST, true)).toBe(
      USER_ROLES.INSTITUTION,
    );
  });
});

describe('exhibition owner roles for an individual account', () => {
  it('keeps gallery and artist plus the current mode', () => {
    expect(getExhibitionOwnerRoleOptions(USER_ROLES.INSTITUTION)).toEqual([
      USER_ROLES.GALLERY,
      USER_ROLES.ARTIST,
      USER_ROLES.INSTITUTION,
    ]);
    expect(canOwnExhibitionAs(USER_ROLES.ARTIST, USER_ROLES.INSTITUTION)).toBe(true);
  });
});
