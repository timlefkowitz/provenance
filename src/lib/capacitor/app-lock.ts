/**
 * Optional Face ID app lock. The setting is per device (it protects this
 * phone, not the account), so it lives in localStorage rather than the DB.
 */
const APP_LOCK_KEY = 'pv_app_lock_enabled';

/** Re-lock after the app has been in the background this long. */
export const APP_LOCK_GRACE_MS = 60_000;

export function isAppLockEnabled(): boolean {
  try {
    return localStorage.getItem(APP_LOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAppLockEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(APP_LOCK_KEY, '1');
    else localStorage.removeItem(APP_LOCK_KEY);
  } catch (err) {
    console.error('[AppLock] could not save setting', err);
  }
}
