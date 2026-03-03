/**
 * Structured logger for Vercel serverless functions.
 * Outputs JSON to stdout/stderr so logs appear in Vercel dashboard and can be searched.
 * Use these instead of ad-hoc console.log for production observability.
 */
type LogLevel = 'info' | 'warn' | 'error';

function normalizeErrorValue(value: unknown) {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }
  return value;
}

function log(level: LogLevel, event: string, data: Record<string, unknown> = {}) {
  const normalizedData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    normalizedData[key] = normalizeErrorValue(value);
  }

  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    ...normalizedData,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => log('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => log('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => log('error', event, data),
};
