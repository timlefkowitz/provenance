import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { extractTextFromCvBuffer } from '~/app/grants/_actions/extract-text-from-cv';
import { ALL_TACO_TOOLS } from './tools';
import {
  handleSearchArtworks,
  handleSearchArtists,
  handleGetMyCollection,
  handleListMyExhibitions,
  handleSuggestNavigation,
  type NavigationSuggestion,
} from './tool-handlers';

export const maxDuration = 60;

/** Maximum agentic iterations before forcing a final reply. */
const MAX_ITERATIONS = 6;

const SYSTEM_PROMPT = `You are Taco, a sleek black cat and the studio AI on Provenance — a platform for artists, galleries, and collectors to document and share art history.

You are warm, knowledgeable, and faintly feline. Occasional *italicised cat actions* are welcome but keep them subtle. You are deeply familiar with the art world: grants, residencies, open calls, art writing, provenance, exhibitions, and artist practice.

Your abilities:
- Look up the user's own artwork collection and exhibitions using tools.
- Search the Provenance registry for artworks and artists.
- Help with writing: artist statements, grant applications, exhibition texts, proposals.
- Answer questions about art history, technique, markets, and practice.
- Analyse images and read documents the user shares with you.
- Suggest relevant pages in the app using the suggest_navigation tool.

Guidelines:
- Always call the appropriate tool when the user asks about their data — don't guess.
- After retrieving data, summarise it clearly and concisely.
- Use suggest_navigation when there's a natural next step in the app (e.g. after mentioning grants, suggest "/grants").
- Keep replies focused. Long prose should be broken into short paragraphs or bullets.
- Never fabricate artworks, exhibitions, or grant details — use tools and be honest about limits.
- If a user shares an image, describe it and offer insight relevant to their practice.
- If a user shares a document, summarise it and offer to help with writing or analysis.`;

/* -------------------------------------------------------------------------- */
/*  Build multimodal user message                                             */
/* -------------------------------------------------------------------------- */

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'auto' } };

function buildUserContent(
  messageText: string,
  images: { dataUrl: string; name: string }[],
  extractedDocs: { name: string; text: string }[],
): ContentPart[] | string {
  const parts: ContentPart[] = [];

  // Main text
  let text = messageText;

  // Append extracted doc text as context
  if (extractedDocs.length > 0) {
    const docContext = extractedDocs
      .map((d) => `--- Document: ${d.name} ---\n${d.text.slice(0, 6000)}`)
      .join('\n\n');
    text = text
      ? `${text}\n\n[Attached documents for context:]\n${docContext}`
      : `[Attached documents — please read and help:]\n${docContext}`;
  }

  if (text) {
    parts.push({ type: 'text', text });
  }

  // Images as vision parts
  for (const img of images) {
    parts.push({
      type: 'image_url',
      image_url: { url: img.dataUrl, detail: 'auto' },
    });
  }

  return parts.length === 1 && parts[0]?.type === 'text' ? (parts[0] as { type: 'text'; text: string }).text : parts;
}

/* -------------------------------------------------------------------------- */
/*  Route handler                                                             */
/* -------------------------------------------------------------------------- */

export async function POST(request: NextRequest) {
  console.log('[Taco] POST /api/taco/chat');

  try {
    // -- Auth --
    const client = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      console.error('[Taco] auth failed', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // -- API key guard --
    const apiKey = (process.env.OPENAI_API_KEY ?? '').trim();
    if (!apiKey) {
      console.error('[Taco] OPENAI_API_KEY not set');
      return NextResponse.json({ error: 'Taco is taking a nap — AI not configured.' }, { status: 503 });
    }

    // -- Parse body --
    const body = await request.json().catch(() => ({})) as {
      message?: string;
      history?: { role: string; content: string }[];
      images?: { dataUrl: string; name: string }[];
      docs?: { name: string; mime: string; base64: string }[];
    };

    const messageText = (typeof body.message === 'string' ? body.message : '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const incomingImages = Array.isArray(body.images) ? body.images.slice(0, 8) : [];
    const incomingDocs = Array.isArray(body.docs) ? body.docs.slice(0, 5) : [];

    if (!messageText && incomingImages.length === 0 && incomingDocs.length === 0) {
      return NextResponse.json({ error: 'Message, image, or document required' }, { status: 400 });
    }

    // -- Extract text from uploaded documents --
    const extractedDocs: { name: string; text: string }[] = [];
    for (const doc of incomingDocs) {
      try {
        const buffer = Buffer.from(doc.base64, 'base64').buffer as ArrayBuffer;
        console.log('[Taco] extracting text from doc', doc.name, doc.mime);
        const { text, error } = await extractTextFromCvBuffer(buffer, doc.mime);
        if (!error && text) {
          extractedDocs.push({ name: doc.name, text });
        } else if (error) {
          console.error('[Taco] doc extraction error', doc.name, error);
        }
      } catch (err) {
        console.error('[Taco] doc decode error', doc.name, err);
      }
    }

    // -- Build message list --
    const userContent = buildUserContent(messageText, incomingImages, extractedDocs);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history
        .slice(-12)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      {
        role: 'user',
        content: userContent as OpenAI.Chat.Completions.ChatCompletionMessageParam['content'],
      },
    ];

    const openai = new OpenAI({ apiKey });

    // -- Agentic loop --
    const collectedSuggestions: NavigationSuggestion[] = [];

    // Accumulated token counts across all iterations
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let completedIterations = 0;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log('[Taco] agent iteration', iteration + 1);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: ALL_TACO_TOOLS,
        tool_choice: 'auto',
      });

      // Accumulate usage from this iteration
      if (completion.usage) {
        totalPromptTokens += completion.usage.prompt_tokens ?? 0;
        totalCompletionTokens += completion.usage.completion_tokens ?? 0;
      }
      completedIterations = iteration + 1;

      const msg = completion.choices[0]?.message;
      if (!msg) break;

      messages.push(msg as OpenAI.Chat.Completions.ChatCompletionMessageParam);

      if (!msg.tool_calls?.length) {
        console.log('[Taco] agent done after', iteration + 1, 'iterations');
        break;
      }

      for (const tc of msg.tool_calls) {
        let result: unknown;

        try {
          const args = JSON.parse(tc.function.arguments ?? '{}') as Record<string, unknown>;

          switch (tc.function.name) {
            case 'search_artworks':
              result = await handleSearchArtworks(args as { query?: string }, user.id);
              break;
            case 'search_artists':
              result = await handleSearchArtists(args as { query?: string });
              break;
            case 'get_my_collection':
              result = await handleGetMyCollection(user.id);
              break;
            case 'list_my_exhibitions':
              result = await handleListMyExhibitions(user.id);
              break;
            case 'suggest_navigation': {
              const suggestions = handleSuggestNavigation(
                args as { suggestions?: NavigationSuggestion[] },
              );
              collectedSuggestions.push(...suggestions);
              result = { acknowledged: true, count: suggestions.length };
              break;
            }
            default:
              result = { error: `Unknown tool: ${tc.function.name}` };
          }
        } catch (err) {
          console.error('[Taco] tool error', tc.function.name, err);
          result = { error: err instanceof Error ? err.message : 'Tool execution failed' };
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    // -- Extract final reply --
    const lastAssistant = [...messages]
      .reverse()
      .find(
        (m) =>
          m.role === 'assistant' &&
          typeof m.content === 'string' &&
          (m.content as string).trim().length > 0,
      );

    const reply =
      typeof lastAssistant?.content === 'string'
        ? lastAssistant.content.trim()
        : "*blinks slowly* I got a bit tangled. Try again?";

    // -- Fire-and-forget usage log (does not block the response) --
    const estimatedCostUsd =
      (totalPromptTokens * 2.5 + totalCompletionTokens * 10.0) / 1_000_000;

    console.log('[Taco] usage tokens=', totalPromptTokens + totalCompletionTokens,
      'prompt=', totalPromptTokens, 'completion=', totalCompletionTokens,
      'cost~$', estimatedCostUsd.toFixed(6), 'iterations=', completedIterations,
    );

    void (async () => {
      try {
        const adminClient = getSupabaseServerAdminClient();
        const { error: logError } = await (adminClient as any)
          .from('taco_usage_logs')
          .insert({
            user_id: user.id,
            prompt_tokens: totalPromptTokens,
            completion_tokens: totalCompletionTokens,
            total_tokens: totalPromptTokens + totalCompletionTokens,
            agent_iterations: completedIterations,
            had_images: incomingImages.length > 0,
            had_docs: incomingDocs.length > 0,
            estimated_cost_usd: estimatedCostUsd,
          });
        if (logError) {
          console.error('[Taco] usage log insert failed', logError);
        } else {
          console.log('[Taco] usage log inserted');
        }
      } catch (logErr) {
        console.error('[Taco] usage log threw', logErr);
      }
    })();

    console.log(
      '[Taco] returning reply, suggestions=',
      collectedSuggestions.length,
    );

    return NextResponse.json({
      reply,
      suggestions: collectedSuggestions.length ? collectedSuggestions : undefined,
    });
  } catch (err) {
    console.error('[Taco] chat error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}
