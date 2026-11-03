import { describe, expect, it } from 'vitest';

import { RESUME_ROUTE_MAX_AGE_MS, isResumablePath, parseResumeRoute } from './resume-route';

const NOW = 1_800_000_000_000;

describe('isResumablePath', () => {
  it('accepts app routes with their query', () => {
    expect(isResumablePath('/artworks/abc/certificate?tab=history')).toBe(true);
  });

  it('rejects auth handlers and anything off-site', () => {
    expect(isResumablePath('/auth/confirm?token_hash=x')).toBe(false);
    expect(isResumablePath('//evil.example/path')).toBe(false);
    expect(isResumablePath('https://evil.example/')).toBe(false);
  });
});

describe('parseResumeRoute', () => {
  it('returns a recently saved route', () => {
    expect(parseResumeRoute(JSON.stringify({ path: '/profiles', savedAt: NOW - 1000 }), NOW)).toBe('/profiles');
  });

  it('ignores stale, malformed or unsafe entries', () => {
    expect(parseResumeRoute(JSON.stringify({ path: '/profiles', savedAt: NOW - RESUME_ROUTE_MAX_AGE_MS - 1 }), NOW)).toBeNull();
    expect(parseResumeRoute('not json', NOW)).toBeNull();
    expect(parseResumeRoute(JSON.stringify({ path: 42, savedAt: NOW }), NOW)).toBeNull();
    expect(parseResumeRoute(JSON.stringify({ path: '/auth/callback', savedAt: NOW }), NOW)).toBeNull();
    expect(parseResumeRoute(null, NOW)).toBeNull();
  });
});
