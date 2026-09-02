/**
 * Tracks whether RevenueCat's Purchases SDK has finished `configure()`.
 *
 * NativeInit configures RevenueCat asynchronously on mount, but the
 * subscription page's buy button can render (and be tapped) before that
 * resolves — or configure() can fail entirely (e.g. missing API key). Calling
 * any Purchases method before configure() succeeds throws "Purchases must be
 * configured before calling this function", so callers should await
 * `waitForRevenueCatReady()` first instead of assuming NativeInit already ran.
 */

type Status = 'pending' | 'ready' | 'unavailable';

let status: Status = 'pending';
let resolveReady: (() => void) | null = null;

const readyPromise = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

export function markRevenueCatReady() {
  status = 'ready';
  resolveReady?.();
}

export function markRevenueCatUnavailable() {
  status = 'unavailable';
}

export function getRevenueCatStatus(): Status {
  return status;
}

/**
 * Resolves true once RevenueCat is configured, or false if it's known to be
 * unavailable or doesn't become ready within `timeoutMs`.
 */
export async function waitForRevenueCatReady(timeoutMs = 8000): Promise<boolean> {
  if (status === 'ready') return true;
  if (status === 'unavailable') return false;

  return Promise.race([
    readyPromise.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
}
