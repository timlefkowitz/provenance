import { describe, expect, it } from 'vitest';

import { inviteIsForUser, resolveHandoffTarget } from './target';

describe('resolveHandoffTarget', () => {
  it('prefers a picked account over an email', () => {
    expect(resolveHandoffTarget({ recipientUserId: 'u1', email: 'a@b.co' })).toEqual({
      ok: true,
      target: { kind: 'user', userId: 'u1' },
    });
  });

  it('normalizes an email target', () => {
    expect(resolveHandoffTarget({ email: '  Ana@Example.COM ' })).toEqual({
      ok: true,
      target: { kind: 'email', email: 'ana@example.com' },
    });
  });

  it('falls back to the email saved on the profile', () => {
    expect(resolveHandoffTarget({ fallbackEmail: 'saved@example.com' })).toEqual({
      ok: true,
      target: { kind: 'email', email: 'saved@example.com' },
    });
  });

  it('needs an account or an email', () => {
    const result = resolveHandoffTarget({ email: '  ', recipientUserId: '' });
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed email', () => {
    const result = resolveHandoffTarget({ email: 'not-an-email' });
    expect(result).toEqual({ ok: false, error: 'Enter a valid email address' });
  });
});

describe('inviteIsForUser', () => {
  const user = { id: 'u1', email: 'Ana@Example.com' };

  it('matches an invite pinned to the account', () => {
    expect(inviteIsForUser({ recipient_user_id: 'u1', invitee_email: null }, user)).toBe(true);
  });

  it('pinned invites ignore a matching email on another account', () => {
    expect(inviteIsForUser({ recipient_user_id: 'u2', invitee_email: 'ana@example.com' }, user)).toBe(false);
  });

  it('matches an email-only invite case-insensitively', () => {
    expect(inviteIsForUser({ recipient_user_id: null, invitee_email: 'ana@example.com' }, user)).toBe(true);
  });

  it('does not match a different email', () => {
    expect(inviteIsForUser({ recipient_user_id: null, invitee_email: 'bo@example.com' }, user)).toBe(false);
  });

  it('does not match when the user has no email', () => {
    expect(inviteIsForUser({ invitee_email: 'ana@example.com' }, { id: 'u1', email: null })).toBe(false);
  });

  it('handles a missing invite', () => {
    expect(inviteIsForUser(null, user)).toBe(false);
  });
});
