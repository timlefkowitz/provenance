/**
 * Universal links (a scanned QR code, a tapped link in Mail or Messages) that
 * open the iOS app.
 *
 * iOS hands the link to the app, and Capacitor normally re-emits it to the
 * page as an `appUrlOpen` event. That event can be lost: on a cold launch in
 * older native builds it fires before the page is listening, and when iOS has
 * killed the WebView in the background, it goes to the page that is being
 * replaced. The link is still available from `App.getLaunchUrl()`, so the app
 * also reads it on load, and every link is followed once.
 */

const HANDLED_KEY = 'pv_incoming_link_handled';

function isProvenanceHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'provenance.guru' || host.endsWith('.provenance.guru');
}

/** In-app path for an https Provenance link, or null for anything else. */
export function incomingLinkPath(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !isProvenanceHost(url.hostname)) return null;
  return `${url.pathname}${url.search}`;
}

function handledLinks(): string[] {
  try {
    const raw = sessionStorage.getItem(HANDLED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Records the link as followed. Returns false when it was already followed in
 * this WebView session, so a page reload (or an `/auth/*` full navigation)
 * can't replay the same launch link.
 */
export function claimIncomingLink(rawUrl: string): boolean {
  const handled = handledLinks();
  if (handled.includes(rawUrl)) return false;
  try {
    sessionStorage.setItem(HANDLED_KEY, JSON.stringify([...handled.slice(-19), rawUrl]));
  } catch {
    // Storage unavailable — follow the link anyway.
  }
  return true;
}

// ── Launch-link hand-off ──────────────────────────────────────────────────────

const FOLLOWED_KEY = 'pv_launch_link_followed';
/** Path the head script sent the app to; the splash skips itself on arrival. */
export const LAUNCH_TARGET_KEY = 'pv_launch_link_target';
/** Window event: a launch navigation is under way; detail is the target path. */
export const LAUNCH_NAVIGATION_EVENT = 'pv:launch-navigation';

const RECENT_FOLLOW_MS = 15_000;

/** Records that the launch link was just followed (by the head script or NativeInit). */
export function markLaunchLinkFollowed(rawUrl: string, now = Date.now()) {
  try {
    sessionStorage.setItem(FOLLOWED_KEY, JSON.stringify({ url: rawUrl, at: now }));
  } catch {
    // ignore
  }
}

/**
 * True when this link was followed at launch moments ago, so the matching
 * appUrlOpen (newer native builds deliver both) must not navigate again —
 * that would replay a one-time /auth/* token. Consumes the record.
 */
export function takeRecentLaunchFollow(rawUrl: string, now = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(FOLLOWED_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as { url?: unknown; at?: unknown };
    if (saved.url !== rawUrl || typeof saved.at !== 'number') return false;
    sessionStorage.removeItem(FOLLOWED_KEY);
    return now - saved.at < RECENT_FOLLOW_MS;
  } catch {
    return false;
  }
}

/** Tells the splash to stay up until `path` has rendered. */
export function announceLaunchNavigation(path: string) {
  try {
    window.dispatchEvent(new CustomEvent(LAUNCH_NAVIGATION_EVENT, { detail: path }));
  } catch {
    // ignore
  }
}

/**
 * Inline <head> script for app requests. Runs before the landing page (the
 * feed) downloads or starts up: asks iOS for the link that launched the app
 * and, if it's an unfollowed Provenance link, replaces the page with it at
 * once. A wordmark covers the page for that native round trip (capped) so
 * the feed never flashes. Only the first page load of a WebView session
 * (the launch); NativeInit's fallback covers the rest. Mirrors
 * incomingLinkPath / claimIncomingLink above.
 */
export const LAUNCH_LINK_SCRIPT = `(function(){try{
var cap=window.Capacitor;
if(!cap||!cap.nativePromise||!cap.isNativePlatform||!cap.isNativePlatform())return;
if(sessionStorage.getItem('pv_launch_checked'))return;
sessionStorage.setItem('pv_launch_checked','1');
var d=document.documentElement,leaving=false;
var o=document.createElement('div');
o.setAttribute('aria-hidden','true');
o.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#F8F4F0;display:flex;align-items:center;justify-content:center;color:#4b3224;font:300 clamp(2.75rem,13vw,4.5rem)/1 var(--font-cormorant),"Cormorant Garamond",Georgia,serif;letter-spacing:0.04em;';
o.textContent='provenance';
d.appendChild(o);
function show(){if(leaving||!o.parentNode)return;o.parentNode.removeChild(o);}
setTimeout(show,1200);
cap.nativePromise('App','getLaunchUrl',{}).then(function(r){
var raw=r&&r.url;if(!raw)return show();
var u=new URL(raw),h=u.hostname.toLowerCase();
if(u.protocol!=='https:'||!(h==='provenance.guru'||h.slice(-16)==='.provenance.guru'))return show();
var path=u.pathname+u.search,list=[];
try{list=JSON.parse(sessionStorage.getItem('${HANDLED_KEY}')||'[]');}catch(e){}
if(!Array.isArray(list))list=[];
if(list.indexOf(raw)!==-1||path===location.pathname+location.search)return show();
list=list.slice(-19);list.push(raw);
sessionStorage.setItem('${HANDLED_KEY}',JSON.stringify(list));
sessionStorage.setItem('${FOLLOWED_KEY}',JSON.stringify({url:raw,at:Date.now()}));
sessionStorage.setItem('${LAUNCH_TARGET_KEY}',path);
leaving=true;
location.replace(path);
}).catch(show);
}catch(e){}})();`;
