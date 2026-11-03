/**
 * Resume where the user left off in the iOS app.
 *
 * The app is a WKWebView on the live site. When iOS reclaims it in the
 * background (memory pressure after switching apps), the next open is a cold
 * launch that loads server.url — the landing page — instead of the screen the
 * user was on. We remember the last route on this device and send the user
 * back to it on launch.
 */
const RESUME_ROUTE_KEY = 'pv_resume_route';

/** Set once per WebView session so only the launch load is restored. */
const LAUNCH_HANDLED_KEY = 'pv_resume_handled';

/** Older than this and the app opens fresh, like a new visit. */
export const RESUME_ROUTE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type SavedRoute = { path: string; savedAt: number };

/**
 * Set when a universal link or push notification takes the user somewhere on
 * launch; that destination wins over the remembered route.
 */
let launchNavigationClaimed = false;

export function claimLaunchNavigation() {
  launchNavigationClaimed = true;
}

/** Whether a route is safe and worth reopening. */
export function isResumablePath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  // /auth/* are route handlers that consume one-time codes.
  if (path.startsWith('/auth/')) return false;
  return true;
}

export function saveResumeRoute(path: string, now = Date.now()) {
  if (!isResumablePath(path)) return;
  try {
    localStorage.setItem(RESUME_ROUTE_KEY, JSON.stringify({ path, savedAt: now } satisfies SavedRoute));
  } catch {
    // Storage unavailable — resuming is best effort.
  }
}

export function parseResumeRoute(raw: string | null, now = Date.now()): string | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Partial<SavedRoute>;
    if (typeof saved.path !== 'string' || typeof saved.savedAt !== 'number') return null;
    if (now - saved.savedAt > RESUME_ROUTE_MAX_AGE_MS) return null;
    return isResumablePath(saved.path) ? saved.path : null;
  } catch {
    return null;
  }
}

/**
 * The route to reopen, or null when this load isn't an app launch, nothing is
 * saved, or the user is already there. Only answers non-null once per launch.
 */
export function takeLaunchResumeRoute(currentPath: string): string | null {
  try {
    if (sessionStorage.getItem(LAUNCH_HANDLED_KEY)) return null;
    sessionStorage.setItem(LAUNCH_HANDLED_KEY, '1');
    if (launchNavigationClaimed) return null;
    const path = parseResumeRoute(localStorage.getItem(RESUME_ROUTE_KEY));
    return path && path !== currentPath ? path : null;
  } catch {
    return null;
  }
}

export function canResumeLaunchRoute(): boolean {
  return !launchNavigationClaimed;
}
