import { beforeEach, describe, expect, it } from 'vitest';

import { claimIncomingLink, incomingLinkPath } from './incoming-link';

describe('incomingLinkPath', () => {
  it('maps Provenance links to in-app paths with their query', () => {
    expect(incomingLinkPath('https://www.provenance.guru/exhibitions/abc')).toBe('/exhibitions/abc');
    expect(incomingLinkPath('https://provenance.guru/artworks/x/certificate?scan=true')).toBe(
      '/artworks/x/certificate?scan=true',
    );
  });

  it('ignores other hosts, plain http and the native auth scheme', () => {
    expect(incomingLinkPath('https://evil.example/exhibitions/abc')).toBeNull();
    expect(incomingLinkPath('https://provenance.guru.evil.example/')).toBeNull();
    expect(incomingLinkPath('http://www.provenance.guru/about')).toBeNull();
    expect(incomingLinkPath('guru.provenance.app://auth/callback?code=1')).toBeNull();
    expect(incomingLinkPath('not a url')).toBeNull();
  });
});

describe('claimIncomingLink', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  it('follows each link once per WebView session', () => {
    const link = 'https://www.provenance.guru/exhibitions/abc';
    expect(claimIncomingLink(link)).toBe(true);
    expect(claimIncomingLink(link)).toBe(false);
    expect(claimIncomingLink('https://www.provenance.guru/exhibitions/def')).toBe(true);
  });
});
