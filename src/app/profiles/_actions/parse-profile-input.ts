import { z } from 'zod';
import { type UserRole, USER_ROLES, getRoleLabel } from '~/lib/user-roles';

/**
 * Structured fields Taco can extract from a single free-form chat message.
 * These map 1:1 onto the columns used by `createProfile` so the chat
 * preview is always a faithful "what we'll save" view.
 */
export type ParsedProfileFields = {
  name?: string;
  location?: string;
  address?: string;
  established_year?: number;
  bio?: string;
  medium?: string;
  website?: string;
  contact_email?: string;
  phone?: string;
};

/**
 * Zod schema used by the streaming route handler with `Output.object()`.
 *
 * NOTE: OpenAI's strict mode (default in AI SDK 6) requires all keys to be
 * required, so we use `.nullable()` rather than `.optional()`. On the wire
 * we just send `null` for missing fields and strip them client-side.
 *
 * `taco_reply` is intentionally listed FIRST so progressive JSON parsing
 * reveals Taco's reply before the structured fields finish — that's what
 * gives the chat the streaming "typing" feel.
 */
export const parsedProfileSchema = z.object({
  taco_reply: z
    .string()
    .describe(
      'A SHORT (max ~20 words), warm, slightly catlike acknowledgement of what was just heard. No follow-up questions — the chat host asks the next one.',
    ),
  name: z.string().nullable().describe('Display name of the artist / collector / gallery / institution.'),
  location: z
    .string()
    .nullable()
    .describe('Human-readable location, e.g. "New York, NY, USA" or "Berlin, Germany".'),
  address: z.string().nullable().describe('Street address if explicitly provided.'),
  established_year: z
    .number()
    .int()
    .nullable()
    .describe('Year founded (galleries / institutions only).'),
  bio: z.string().nullable().describe('Short biography or mission statement.'),
  medium: z
    .string()
    .nullable()
    .describe('Primary medium or discipline (artists only), e.g. "Oil on canvas".'),
  website: z.string().nullable().describe('Public website URL.'),
  contact_email: z.string().nullable().describe('Public contact email.'),
  phone: z.string().nullable().describe('Public phone number.'),
});

export type ParsedProfilePayload = z.infer<typeof parsedProfileSchema>;

/** Map a "current field" hint onto a single string field. */
export const FIELD_LABELS: Record<keyof ParsedProfileFields, string> = {
  name: 'name',
  location: 'location (city, region, country)',
  address: 'street address',
  established_year: 'year established',
  bio: 'short bio / description',
  medium: 'medium or discipline',
  website: 'website URL',
  contact_email: 'public contact email',
  phone: 'phone number',
};

const TACO_FALLBACK_REPLIES = [
  '*slow blink* Got it.',
  'Noted. *tail flick*',
  '*headbumps the keyboard* Logged.',
  'Mmhm. Filing that under "things humans tell me".',
  '*purrs* Okay, next.',
];

export function pickFallbackReply() {
  return TACO_FALLBACK_REPLIES[
    Math.floor(Math.random() * TACO_FALLBACK_REPLIES.length)
  ]!;
}

/**
 * Best-effort heuristic parser used when OPENAI_API_KEY isn't configured.
 * Keeps the chat usable in dev/staging without an LLM dependency.
 */
export function heuristicParse(
  input: string,
  currentField: keyof ParsedProfileFields,
): ParsedProfileFields {
  const out: ParsedProfileFields = {};
  const trimmed = input.trim();
  if (!trimmed) return out;

  const emailMatch = trimmed.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) out.contact_email = emailMatch[0];

  const urlMatch = trimmed.match(/https?:\/\/[^\s,]+/i);
  if (urlMatch) out.website = urlMatch[0];

  const yearMatch = trimmed.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0], 10);
    if (year >= 1500 && year <= new Date().getFullYear()) {
      out.established_year = year;
    }
  }

  let remainder = trimmed;
  for (const m of [emailMatch?.[0], urlMatch?.[0], yearMatch?.[0]]) {
    if (m) remainder = remainder.replace(m, '');
  }
  remainder = remainder.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '');

  if (remainder && !out[currentField]) {
    if (currentField === 'established_year') {
      const n = parseInt(remainder.replace(/\D/g, ''), 10);
      if (!Number.isNaN(n)) out.established_year = n;
    } else {
      out[currentField] = remainder as never;
    }
  }

  return out;
}

/**
 * Whitelist + sanitize whatever came back from the model so callers can
 * trust the shape before merging it into the profile draft.
 */
export function sanitizeParsedFields(
  raw: Partial<ParsedProfilePayload> | null | undefined,
): ParsedProfileFields {
  const out: ParsedProfileFields = {};
  if (!raw) return out;

  if (typeof raw.name === 'string' && raw.name.trim()) {
    out.name = raw.name.trim().slice(0, 200);
  }
  if (typeof raw.location === 'string' && raw.location.trim()) {
    out.location = raw.location.trim().slice(0, 200);
  }
  if (typeof raw.address === 'string' && raw.address.trim()) {
    out.address = raw.address.trim().slice(0, 300);
  }
  if (
    typeof raw.established_year === 'number' &&
    Number.isFinite(raw.established_year) &&
    raw.established_year >= 1500 &&
    raw.established_year <= new Date().getFullYear()
  ) {
    out.established_year = Math.floor(raw.established_year);
  }
  if (typeof raw.bio === 'string' && raw.bio.trim()) {
    out.bio = raw.bio.trim().slice(0, 2000);
  }
  if (typeof raw.medium === 'string' && raw.medium.trim()) {
    out.medium = raw.medium.trim().slice(0, 200);
  }
  if (typeof raw.website === 'string' && raw.website.trim()) {
    out.website = raw.website.trim().slice(0, 500);
  }
  if (
    typeof raw.contact_email === 'string' &&
    /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(raw.contact_email.trim())
  ) {
    out.contact_email = raw.contact_email.trim().slice(0, 200);
  }
  if (typeof raw.phone === 'string' && raw.phone.trim()) {
    out.phone = raw.phone.trim().slice(0, 50);
  }

  return out;
}

/**
 * System prompt builder shared between the streaming route handler and
 * any future server-side callers.
 */
export function buildTacoSystemPrompt(opts: {
  role: UserRole;
  currentField: keyof ParsedProfileFields;
  alreadyKnown: ParsedProfileFields;
}) {
  const { role, currentField, alreadyKnown } = opts;
  return `You are Taco, a black cat who acts as a friendly intake assistant on Provenance, an art-world platform that records the history of artworks. You are helping a human set up their ${getRoleLabel(role).toLowerCase()} profile.

The chat host just asked the user for their **${FIELD_LABELS[currentField] ?? currentField}**, but users often volunteer extra info in one message — extract everything you can confidently identify.

Rules:
- Never invent fields. For any field you are not sure about, return null (do NOT hallucinate).
- For "location" prefer "City, Region, Country" form. If the user pastes a full street address, also fill "address".
- For ${USER_ROLES.GALLERY}/${USER_ROLES.INSTITUTION}, watch for an "established" / "founded" year and fill established_year as a plain integer.
- For ${USER_ROLES.ARTIST}, watch for medium ("oil on canvas", "digital sculpture", etc).
- Already-known fields (do NOT overwrite unless the user is correcting them): ${JSON.stringify(alreadyKnown)}.
- "taco_reply" must be SHORT, warm, faintly catlike (occasional *purrs* or *blinks slowly*), no follow-up question.`;
}
