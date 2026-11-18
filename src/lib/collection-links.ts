/**
 * Links saved in Collection Management (Instagram, website, shop…), offered
 * as extra QR codes when printing wall labels. Account-wide links live in
 * accounts.public_data.collection_links; a work's own links in artworks.links.
 */
export type CollectionLink = {
  id: string;
  label: string;
  url: string;
};

export const MAX_COLLECTION_LINKS = 12;
/** Per artwork: more than this crowds a wall label. */
export const MAX_ARTWORK_LINKS = 3;
export const COLLECTION_LINK_LABEL_MAX = 40;
export const COLLECTION_LINK_URL_MAX = 500;

/** Turns what people type ("@handle", "instagram.com/x", "x.com") into a full URL, or null. */
export function normalizeLinkUrl(raw: string, label = ''): string | null {
  const value = raw.trim();
  if (!value) return null;
  // A bare @handle: Instagram unless the label says otherwise.
  const handle = /^@([A-Za-z0-9._]{1,30})$/.exec(value);
  if (handle) {
    const l = label.toLowerCase();
    if (l.includes('tiktok')) return `https://www.tiktok.com/@${handle[1]}`;
    if (l.includes('twitter') || l === 'x') return `https://x.com/${handle[1]}`;
    return `https://instagram.com/${handle[1]}`;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString().slice(0, COLLECTION_LINK_URL_MAX);
  } catch {
    return null;
  }
}

/** A sensible label for a link with none, from its host. */
export function suggestLinkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.endsWith('instagram.com')) return 'Instagram';
    if (host.endsWith('tiktok.com')) return 'TikTok';
    if (host === 'x.com' || host.endsWith('twitter.com')) return 'X';
    if (host.endsWith('facebook.com')) return 'Facebook';
    if (host.endsWith('youtube.com') || host === 'youtu.be') return 'YouTube';
    if (host.endsWith('vimeo.com')) return 'Vimeo';
    if (host.endsWith('linktr.ee')) return 'Linktree';
    return 'Website';
  } catch {
    return 'Website';
  }
}

export function readCollectionLinks(raw: unknown, max = MAX_COLLECTION_LINKS): CollectionLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => {
      const url = typeof e.url === 'string' ? normalizeLinkUrl(e.url) : null;
      if (!url) return null;
      const label = typeof e.label === 'string' ? e.label.trim().slice(0, COLLECTION_LINK_LABEL_MAX) : '';
      return {
        id: typeof e.id === 'string' && e.id ? e.id.slice(0, 20) : Math.random().toString(36).slice(2, 10),
        label: label || suggestLinkLabel(url),
        url,
      };
    })
    .filter((l): l is CollectionLink => l !== null)
    .slice(0, max);
}
