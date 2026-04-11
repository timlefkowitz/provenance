import { NextResponse } from 'next/server';

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = 'Resource not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = 'Internal server error', error?: unknown) {
  if (error) {
    console.error('[API] Server error:', message, error);
  }
  return NextResponse.json({ error: message }, { status: 500 });
}
