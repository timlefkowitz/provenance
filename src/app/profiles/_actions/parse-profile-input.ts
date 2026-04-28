'use server';

import OpenAI from 'openai';
import { USER_ROLES, getRoleLabel, type UserRole } from '~/lib/user-roles';

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

export type ParseProfileInputResult = {
  /** Newly extracted fields (only the ones present in this message). */
  extracted: ParsedProfileFields;
  /** Taco's short, in-character acknowledgement to render as the next message. */
  reply: string;
  /** Set when OpenAI is unavailable so the caller can degrade gracefully. */
  warning?: string;
};

/** Map a "current field" hint onto a single string field. */
const FIELD_LABELS: Record<string, string> = {
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

/**
 * Best-effort heuristic parser used when OPENAI_API_KEY isn't configured.
 * Keeps the chat usable in dev/staging without an LLM dependency.
 */
function heuristicParse(
  input: string,
  currentField: keyof ParsedProfileFields,
): ParsedProfileFields {
  const out: ParsedProfileFields = {};
  const trimmed = input.trim();
  if (!trimmed) return out;

  // Cheap email / URL / year sniffing — useful regardless of which
  // field we *think* we're collecting, because users paste mixed input.
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

  // Anything left over goes in the field the chatbot was just asking
  // about, with the matched substrings stripped out.
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

const TACO_FALLBACK_REPLIES = [
  '*slow blink* Got it.',
  'Noted. *tail flick*',
  '*headbumps the keyboard* Logged.',
  'Mmhm. Filing that under "things humans tell me".',
  '*purrs* Okay, next.',
];

function pickFallbackReply() {
  return TACO_FALLBACK_REPLIES[
    Math.floor(Math.random() * TACO_FALLBACK_REPLIES.length)
  ]!;
}

/**
 * Parse a single chat message from the user into structured profile fields.
 *
 * The model is allowed (and encouraged) to fill more than one field per
 * message — e.g. "MoMA, 11 W 53rd St, New York, NY, est. 1929" should yield
 * `{ name, address, location, established_year }` in one shot.
 */
export async function parseProfileInput(opts: {
  input: string;
  role: UserRole;
  currentField: keyof ParsedProfileFields;
  alreadyKnown: ParsedProfileFields;
}): Promise<ParseProfileInputResult> {
  const { input, role, currentField, alreadyKnown } = opts;

  const safeInput = String(input ?? '').slice(0, 2000).trim();
  if (!safeInput) {
    return {
      extracted: {},
      reply: '*tilts head* I didn\'t catch anything there. Try again?',
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      extracted: heuristicParse(safeInput, currentField),
      reply: pickFallbackReply(),
      warning: 'OPENAI_API_KEY not set — used local heuristic parser.',
    };
  }

  const tool: OpenAI.Chat.Completions.ChatCompletionTool = {
    type: 'function',
    function: {
      name: 'extract_profile_fields',
      description:
        'Extract any profile fields the user provided. Only include keys you are confident about. Omit anything ambiguous.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'Display name of the artist / collector / gallery / institution.',
          },
          location: {
            type: 'string',
            description:
              'Human-readable location, e.g. "New York, NY, USA" or "Berlin, Germany".',
          },
          address: {
            type: 'string',
            description: 'Street address if explicitly provided.',
          },
          established_year: {
            type: 'integer',
            description: 'Year founded (galleries / institutions only).',
          },
          bio: {
            type: 'string',
            description: 'Short biography or mission statement.',
          },
          medium: {
            type: 'string',
            description:
              'Primary medium or discipline (artists only), e.g. "Oil on canvas".',
          },
          website: { type: 'string', description: 'Public website URL.' },
          contact_email: { type: 'string', description: 'Public contact email.' },
          phone: { type: 'string', description: 'Public phone number.' },
          taco_reply: {
            type: 'string',
            description:
              'A SHORT (max ~20 words), warm, slightly catlike acknowledgement of what you just heard. No questions — the chat host will ask the next one.',
          },
        },
        required: ['taco_reply'],
      },
    },
  };

  const systemPrompt = `You are Taco, a black cat who acts as a friendly intake assistant on Provenance, an art-world platform that records the history of artworks. You are helping a human set up their ${getRoleLabel(role).toLowerCase()} profile.

The chat host just asked the user for their **${FIELD_LABELS[currentField] ?? currentField}**, but users often volunteer extra info in one message — extract everything you can confidently identify.

Rules:
- Never invent fields. Only fill keys you are sure about.
- For "location" prefer "City, Region, Country" form. If the user pastes a full street address, also fill "address".
- For ${USER_ROLES.GALLERY}/${USER_ROLES.INSTITUTION}, watch for an "established" / "founded" year and fill established_year as a plain integer.
- For ${USER_ROLES.ARTIST}, watch for medium ("oil on canvas", "digital sculpture", etc).
- Already-known fields (do NOT overwrite unless the user is correcting them): ${JSON.stringify(alreadyKnown)}.
- Always respond by calling the extract_profile_fields tool. Always include a short, in-character "taco_reply" — warm, faintly catlike (occasional *purrs* or *blinks slowly*), no follow-up question.`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: safeInput },
      ],
      tools: [tool],
      tool_choice: {
        type: 'function',
        function: { name: 'extract_profile_fields' },
      },
      temperature: 0.4,
    });

    const call = completion.choices[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments;
    if (!args) {
      return {
        extracted: heuristicParse(safeInput, currentField),
        reply: pickFallbackReply(),
        warning: 'Model returned no tool call.',
      };
    }

    const parsed = JSON.parse(args) as ParsedProfileFields & {
      taco_reply?: string;
    };

    // Whitelist + sanitize.
    const extracted: ParsedProfileFields = {};
    if (typeof parsed.name === 'string' && parsed.name.trim())
      extracted.name = parsed.name.trim().slice(0, 200);
    if (typeof parsed.location === 'string' && parsed.location.trim())
      extracted.location = parsed.location.trim().slice(0, 200);
    if (typeof parsed.address === 'string' && parsed.address.trim())
      extracted.address = parsed.address.trim().slice(0, 300);
    if (
      typeof parsed.established_year === 'number' &&
      parsed.established_year >= 1500 &&
      parsed.established_year <= new Date().getFullYear()
    ) {
      extracted.established_year = Math.floor(parsed.established_year);
    }
    if (typeof parsed.bio === 'string' && parsed.bio.trim())
      extracted.bio = parsed.bio.trim().slice(0, 2000);
    if (typeof parsed.medium === 'string' && parsed.medium.trim())
      extracted.medium = parsed.medium.trim().slice(0, 200);
    if (typeof parsed.website === 'string' && parsed.website.trim())
      extracted.website = parsed.website.trim().slice(0, 500);
    if (
      typeof parsed.contact_email === 'string' &&
      /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(parsed.contact_email.trim())
    ) {
      extracted.contact_email = parsed.contact_email.trim().slice(0, 200);
    }
    if (typeof parsed.phone === 'string' && parsed.phone.trim())
      extracted.phone = parsed.phone.trim().slice(0, 50);

    const reply =
      typeof parsed.taco_reply === 'string' && parsed.taco_reply.trim()
        ? parsed.taco_reply.trim().slice(0, 280)
        : pickFallbackReply();

    return { extracted, reply };
  } catch (err) {
    console.error('[Profiles] parseProfileInput error', err);
    return {
      extracted: heuristicParse(safeInput, currentField),
      reply: pickFallbackReply(),
      warning: err instanceof Error ? err.message : 'Parser error',
    };
  }
}
