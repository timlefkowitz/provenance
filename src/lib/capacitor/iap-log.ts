import { logIapEvent } from '~/app/subscription/_actions/log-iap-event';

/** Extracts what's useful from a Capacitor/StoreKit rejection. */
export function describeIapError(err: unknown): { message: string; code?: string } {
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown };
    return {
      message: typeof e.message === 'string' ? e.message : String(err),
      code: typeof e.code === 'string' ? e.code : undefined,
    };
  }
  return { message: String(err) };
}

/** Logs to the device console and (fire-and-forget) to Vercel. */
export function iapLog(
  level: 'info' | 'warn' | 'error',
  event: string,
  data: Record<string, unknown> = {},
): void {
  console[level === 'info' ? 'log' : level](`[IAP] ${event}`, data);
  void logIapEvent(level, event, data).catch(() => undefined);
}
