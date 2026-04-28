import { NextRequest, NextResponse } from 'next/server';
import { streamText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { checkRateLimit } from '~/lib/rate-limit';
import { isValidRole, type UserRole } from '~/lib/user-roles';
import {
  buildTacoSystemPrompt,
  heuristicParse,
  parsedProfileSchema,
  pickFallbackReply,
  type ParsedProfileFields,
} from '~/app/profiles/_actions/parse-profile-input';

export const maxDuration = 30;

const FIELD_KEYS: ReadonlyArray<keyof ParsedProfileFields> = [
  'name',
  'location',
  'address',
  'established_year',
  'bio',
  'medium',
  'website',
  'contact_email',
  'phone',
];

function isFieldKey(value: unknown): value is keyof ParsedProfileFields {
  return typeof value === 'string' && (FIELD_KEYS as readonly string[]).includes(value);
}

/**
 * Build a minimal "stream" response that delivers a single JSON object to
 * the AI SDK `useObject` hook. Used when no `OPENAI_API_KEY` is configured
 * so the chat continues to work in dev with the regex heuristic.
 */
function staticObjectResponse(obj: unknown) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: NextRequest) {
  // -------- auth --------
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // -------- rate limit (per IP, then per user) --------
  // 30 calls / minute is a comfortable cap for a single chat session and
  // keeps a runaway client from burning tokens.
  if (
    !checkRateLimit(req, {
      keyPrefix: `profiles-parse:${user.id}`,
      windowMs: 60_000,
      maxPerWindow: 30,
    })
  ) {
    console.warn('[Profiles] parse-input rate limited', user.id);
    return NextResponse.json(
      { error: 'Slow down — Taco is napping. Try again in a minute.' },
      { status: 429 },
    );
  }

  // -------- input --------
  const body = (await req.json().catch(() => ({}))) as {
    input?: string;
    role?: string;
    currentField?: string;
    alreadyKnown?: ParsedProfileFields;
  };

  const safeInput = String(body.input ?? '').slice(0, 2000).trim();
  const role = body.role;
  const currentField = body.currentField;
  const alreadyKnown =
    body.alreadyKnown && typeof body.alreadyKnown === 'object'
      ? body.alreadyKnown
      : {};

  if (!safeInput) {
    return staticObjectResponse({
      taco_reply: '*tilts head* I didn\'t catch anything there. Try again?',
      name: null,
      location: null,
      address: null,
      established_year: null,
      bio: null,
      medium: null,
      website: null,
      contact_email: null,
      phone: null,
    });
  }
  if (!role || !isValidRole(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }
  if (!isFieldKey(currentField)) {
    return NextResponse.json({ error: 'Invalid currentField' }, { status: 400 });
  }

  // -------- heuristic fallback when no API key --------
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const extracted = heuristicParse(safeInput, currentField);
    return staticObjectResponse({
      taco_reply: pickFallbackReply(),
      name: extracted.name ?? null,
      location: extracted.location ?? null,
      address: extracted.address ?? null,
      established_year: extracted.established_year ?? null,
      bio: extracted.bio ?? null,
      medium: extracted.medium ?? null,
      website: extracted.website ?? null,
      contact_email: extracted.contact_email ?? null,
      phone: extracted.phone ?? null,
    });
  }

  // -------- streaming via AI SDK --------
  try {
    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: buildTacoSystemPrompt({
        role: role as UserRole,
        currentField,
        alreadyKnown,
      }),
      prompt: safeInput,
      output: Output.object({ schema: parsedProfileSchema }),
      temperature: 0.4,
    });

    return result.toTextStreamResponse();
  } catch (err) {
    console.error('[Profiles] parse-input stream error', err);
    const extracted = heuristicParse(safeInput, currentField);
    return staticObjectResponse({
      taco_reply: pickFallbackReply(),
      name: extracted.name ?? null,
      location: extracted.location ?? null,
      address: extracted.address ?? null,
      established_year: extracted.established_year ?? null,
      bio: extracted.bio ?? null,
      medium: extracted.medium ?? null,
      website: extracted.website ?? null,
      contact_email: extracted.contact_email ?? null,
      phone: extracted.phone ?? null,
    });
  }
}
