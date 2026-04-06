import { NextRequest, NextResponse } from 'next/server';

import { logger } from '~/lib/logger';
import { checkRateLimit } from '~/lib/rate-limit';

const ALLOWED_EVENTS = new Set(['trigger_pointerdown', 'menu_open_change']);

/**
 * Debug-only: logs structured JSON to stdout for Vercel function logs.
 * Enable with ACCOUNT_MENU_DEBUG=1 on the server (e.g. Vercel env).
 * Client must send requests with NEXT_PUBLIC_ACCOUNT_MENU_DEBUG=1 so production
 * traffic does not hit this route by default.
 */
export async function POST(req: NextRequest) {
  if (process.env.ACCOUNT_MENU_DEBUG !== '1') {
    return NextResponse.json({ ok: true, logged: false });
  }

  if (
    !checkRateLimit(req, {
      keyPrefix: 'account_menu_debug',
      maxPerWindow: 120,
    })
  ) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const event = typeof body?.event === 'string' ? body.event : '';
    if (!ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const open = typeof body?.open === 'boolean' ? body.open : undefined;
    const ua = req.headers.get('user-agent');
    logger.info('account_menu_debug', {
      event,
      open,
      userAgent: ua ? ua.slice(0, 200) : undefined,
    });

    return NextResponse.json({ ok: true, logged: true });
  } catch (err) {
    console.error('[API/debug/account-menu] failed', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
