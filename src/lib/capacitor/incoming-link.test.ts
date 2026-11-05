import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LAUNCH_LINK_SCRIPT,
  LAUNCH_TARGET_KEY,
  claimIncomingLink,
  incomingLinkPath,
  takeRecentLaunchFollow,
} from './incoming-link';

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

function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

/** Runs the inline head script against stubbed browser + Capacitor globals. */
async function runHeadScript(launchUrl: string | undefined, storage: Storage) {
  const appended: Array<{ parentNode: unknown }> = [];
  const root = {
    appendChild: (node: { parentNode: unknown }) => {
      node.parentNode = root;
      appended.push(node);
    },
    removeChild: (node: { parentNode: unknown }) => {
      node.parentNode = null;
    },
  };
  const document = {
    documentElement: root,
    createElement: () => ({ parentNode: null, style: {}, setAttribute() {}, textContent: '' }),
  };
  const location = { pathname: '/artworks', search: '', replace: vi.fn() };
  const timers: Array<() => void> = [];
  const window = {
    Capacitor: {
      isNativePlatform: () => true,
      nativePromise: vi.fn(async () => ({ url: launchUrl })),
    },
  };
  new Function('window', 'document', 'sessionStorage', 'location', 'setTimeout', LAUNCH_LINK_SCRIPT)(
    window,
    document,
    storage,
    location,
    (fn: () => void) => timers.push(fn),
  );
  await new Promise((r) => setTimeout(r, 0));
  const overlayUp = () => appended.length > 0 && appended[0]!.parentNode !== null;
  return { location, window, timers, overlayUp };
}

describe('LAUNCH_LINK_SCRIPT', () => {
  it('replaces the landing page with an unfollowed launch link and keeps the cover up', async () => {
    const storage = memoryStorage();
    const link = 'https://www.provenance.guru/exhibitions/abc';
    const run = await runHeadScript(link, storage);
    expect(run.location.replace).toHaveBeenCalledWith('/exhibitions/abc');
    expect(storage.getItem(LAUNCH_TARGET_KEY)).toBe('/exhibitions/abc');
    run.timers.forEach((fn) => fn()); // the safety timer must not reveal the feed while leaving
    expect(run.overlayUp()).toBe(true);
    // The matching appUrlOpen is recognised as already followed…
    globalThis.sessionStorage = storage;
    expect(takeRecentLaunchFollow(link)).toBe(true);
    // …and the link counts as handled for the fallback.
    expect(claimIncomingLink(link)).toBe(false);
  });

  it('uncovers the page when there is no launch link', async () => {
    const run = await runHeadScript(undefined, memoryStorage());
    expect(run.location.replace).not.toHaveBeenCalled();
    expect(run.overlayUp()).toBe(false);
  });

  it('ignores non-Provenance links and links already followed', async () => {
    const other = await runHeadScript('https://evil.example/x', memoryStorage());
    expect(other.location.replace).not.toHaveBeenCalled();

    const storage = memoryStorage();
    storage.setItem('pv_incoming_link_handled', JSON.stringify(['https://www.provenance.guru/exhibitions/abc']));
    const seen = await runHeadScript('https://www.provenance.guru/exhibitions/abc', storage);
    expect(seen.location.replace).not.toHaveBeenCalled();
  });

  it('only runs on the first page load of a session', async () => {
    const storage = memoryStorage();
    await runHeadScript(undefined, storage);
    const second = await runHeadScript('https://www.provenance.guru/exhibitions/abc', storage);
    expect(second.window.Capacitor.nativePromise).not.toHaveBeenCalled();
    expect(second.location.replace).not.toHaveBeenCalled();
  });
});
