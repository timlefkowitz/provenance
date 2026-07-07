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
  handleGetMyGrants,
  handleGetMyProfile,
  handleGetMySales,
  handleGetPortalStats,
  handleGetOpenCalls,
  handleSummarizePractice,
  handleCreateExhibition,
  handleAddCvEntry,
  handleUpdateArtistBio,
  handleSearchPress,
  handleSavePressToProfile,
  handleDraftArtistStatement,
  handleDraftExhibitionText,
  handleDraftOpenCallSubmission,
  handleDraftCollectorOutreach,
  handleGenerateWebsiteBio,
  handleSuggestPricing,
  handleGetCollectorContacts,
  handleCreateArtworkDraft,
  handleSearchComparableSales,
  handleFindGrantsForMe,
  type NavigationSuggestion,
} from './tool-handlers';

export const maxDuration = 60;

/** Maximum agentic iterations before forcing a final reply. */
const MAX_ITERATIONS = 6;

const BASE_SYSTEM_PROMPT = `You are Taco, a sleek black cat and the studio AI on Provenance — a platform for artists, galleries, and collectors to document and share art history.

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
- If a user shares a document, summarise it and offer to help with writing or analysis.
- If the user asks you to do something you genuinely CANNOT do (a missing feature, an action outside your capabilities, or something the platform doesn't support yet), call the flag_unhandled_request tool with a specific summary of what they wanted, then tell them warmly that you've noted their request for the team.`;

/** Map route prefixes → human-readable context injected into the system prompt. */
const ROUTE_CONTEXT_MAP: { prefix: string; label: string; hint: string }[] = [
  {
    prefix: '/grants',
    label: 'Grants',
    hint: 'The user is exploring the Grants tool — they can find art grants and residencies, and apply using their artist CV. Encourage uploading a CV if they haven\'t and offer to help draft proposals.',
  },
  {
    prefix: '/artworks/add',
    label: 'Add Artwork',
    hint: 'The user is adding a new artwork / Certificate of Authenticity. Offer help with titles, provenance descriptions, edition details, or any fields they might need.',
  },
  {
    prefix: '/artworks',
    label: 'Artworks & Certificates',
    hint: 'The user is in the artworks area — Certificates of Authenticity, provenance records, and artwork details.',
  },
  {
    prefix: '/exhibitions',
    label: 'Exhibitions',
    hint: 'The user is managing exhibitions. Offer help with writing exhibition descriptions, open calls, or press releases.',
  },
  {
    prefix: '/profile/site',
    label: 'Website Editor',
    hint: 'The user is editing their artist website. Help with bio copy, page structure, or describing their practice.',
  },
  {
    prefix: '/portal/or',
    label: 'CRM / Outreach',
    hint: 'The user is in the CRM and outreach area. Offer help with collector messaging, outreach copy, or tracking contacts.',
  },
  {
    prefix: '/portal/sales',
    label: 'Sales',
    hint: 'The user is reviewing their sales records. Offer help understanding their sales history or market positioning.',
  },
  {
    prefix: '/portal',
    label: 'Portal Dashboard',
    hint: 'The user is in the artist/gallery portal. Offer to summarise their activity or help navigate to specific tools.',
  },
  {
    prefix: '/mailing-list',
    label: 'Mailing List',
    hint: 'The user is managing their mailing list. Offer help writing newsletters or campaign copy.',
  },
  {
    prefix: '/operations',
    label: 'Operations',
    hint: 'The user is in the Operations tool. Offer help with studio logistics, pricing, or planning.',
  },
  {
    prefix: '/open-calls',
    label: 'Open Calls',
    hint: 'The user is browsing open calls. Offer to help find relevant opportunities and draft submission materials.',
  },
  {
    prefix: '/registry',
    label: 'Artist Registry',
    hint: 'The user is browsing the public artist registry.',
  },
  {
    prefix: '/taco',
    label: 'Taco Studio',
    hint: 'The user is in the full Taco studio chat.',
  },
];

function buildSystemPrompt(pathname?: string | null, profileContext?: string | null): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (pathname) {
    const match = ROUTE_CONTEXT_MAP.find((r) => pathname.startsWith(r.prefix));
    if (match) {
      prompt += `\n\nPage context: ${match.hint}`;
    }
  }

  if (profileContext) {
    prompt += `\n\nArtist profile context: ${profileContext}`;
  }

  return prompt;
}

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
      pathname?: string;
    };

    const messageText = (typeof body.message === 'string' ? body.message : '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const incomingImages = Array.isArray(body.images) ? body.images.slice(0, 8) : [];
    const incomingDocs = Array.isArray(body.docs) ? body.docs.slice(0, 5) : [];
    const pathname = typeof body.pathname === 'string' ? body.pathname : null;

    // Optionally enrich with artist profile context for personalized responses
    let profileContext: string | null = null;
    try {
      const { data: artistProfile } = await (client as any)
        .from('user_profiles')
        .select('medium, has_sold_work, onboarding_answers')
        .eq('user_id', user.id)
        .eq('role', 'artist')
        .eq('is_active', true)
        .maybeSingle();

      if (artistProfile) {
        const parts: string[] = [];
        if (artistProfile.medium) parts.push(`primary medium: ${artistProfile.medium}`);
        if (artistProfile.has_sold_work) {
          const soldMap: Record<string, string> = {
            never: 'has not sold work yet',
            occasionally: 'has sold work occasionally',
            regularly: 'sells work regularly',
            gallery_represented: 'is gallery-represented and sells through galleries',
          };
          parts.push(soldMap[artistProfile.has_sold_work as string] ?? `sales history: ${artistProfile.has_sold_work}`);
        }
        if ((artistProfile.onboarding_answers as Record<string, unknown> | null)?.goal) {
          parts.push(`primary goal on Provenance: ${(artistProfile.onboarding_answers as Record<string, unknown>).goal}`);
        }
        if (parts.length) profileContext = parts.join(', ');
      }
    } catch (profileErr) {
      // Non-fatal — just skip profile context
      console.error('[Taco] profile context fetch failed', profileErr);
    }

    console.log('[Taco] pathname=', pathname, 'profileContext=', profileContext);

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

    const SYSTEM_PROMPT = buildSystemPrompt(pathname, profileContext);

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
            // ── Phase 1: reads ──────────────────────────────────────────────
            case 'get_my_grants':
              result = await handleGetMyGrants(user.id);
              break;
            case 'get_my_profile':
              result = await handleGetMyProfile(user.id);
              break;
            case 'get_my_sales':
              result = await handleGetMySales(user.id);
              break;
            case 'get_portal_stats':
              result = await handleGetPortalStats(user.id);
              break;
            case 'get_open_calls':
              result = await handleGetOpenCalls(user.id);
              break;
            case 'summarize_practice':
              result = await handleSummarizePractice(user.id, apiKey);
              break;
            // ── Phase 2: writes ─────────────────────────────────────────────
            case 'create_exhibition':
              result = await handleCreateExhibition(
                args as { title: string; start_date: string; description?: string; location?: string; end_date?: string },
                user.id,
              );
              break;
            case 'add_cv_entry':
              result = await handleAddCvEntry(
                args as { entry_type: 'exhibition' | 'education' | 'award' | 'residency' | 'publication'; name: string; venue_or_institution?: string; year?: string; description?: string },
                user.id,
              );
              break;
            case 'update_artist_bio':
              result = await handleUpdateArtistBio(args as { bio: string; role?: string }, user.id);
              break;
            case 'search_press':
              result = await handleSearchPress(args as { artist_name?: string }, user.id, apiKey);
              break;
            case 'save_press_to_profile':
              result = await handleSavePressToProfile(
                args as { items: { title: string; url: string; publication_name?: string; date?: string }[] },
                user.id,
              );
              break;
            // ── Phase 3: AI writing ─────────────────────────────────────────
            case 'draft_artist_statement':
              result = await handleDraftArtistStatement(args as { focus?: string }, user.id, apiKey);
              break;
            case 'draft_exhibition_text':
              result = await handleDraftExhibitionText(
                args as { exhibition_id?: string; exhibition_title?: string; format?: 'press_release' | 'wall_text' | 'catalogue_note' },
                user.id,
                apiKey,
              );
              break;
            case 'draft_open_call_submission':
              result = await handleDraftOpenCallSubmission(
                args as { open_call_id?: string; open_call_title?: string },
                user.id,
                apiKey,
              );
              break;
            case 'draft_collector_outreach':
              result = await handleDraftCollectorOutreach(
                args as { contact_name: string; context?: string },
                user.id,
                apiKey,
              );
              break;
            case 'generate_website_bio':
              result = await handleGenerateWebsiteBio(
                args as { length?: 'short' | 'medium' },
                user.id,
                apiKey,
              );
              break;
            case 'suggest_pricing':
              result = await handleSuggestPricing(args as { artwork_title: string }, user.id);
              break;
            // ── Phase 4: extended ───────────────────────────────────────────
            case 'get_collector_contacts':
              result = await handleGetCollectorContacts(user.id);
              break;
            case 'create_artwork_draft':
              result = await handleCreateArtworkDraft(
                args as { title: string; medium?: string; year?: string; dimensions?: string; description?: string },
                user.id,
              );
              break;
            case 'search_comparable_sales':
              result = await handleSearchComparableSales(
                args as { medium?: string; artist_name?: string },
                user.id,
              );
              break;
            case 'find_grants_for_me':
              result = await handleFindGrantsForMe(user.id);
              break;
            // ── Meta ────────────────────────────────────────────────────────
            case 'flag_unhandled_request': {
              const summary = String((args as { summary?: string }).summary ?? '').trim();
              if (summary) {
                void (async () => {
                  try {
                    const adminClient = getSupabaseServerAdminClient();
                    const { error: flagErr } = await (adminClient as any)
                      .from('taco_unhandled_requests')
                      .insert({
                        user_id: user.id,
                        user_message: messageText.slice(0, 2000),
                        taco_summary: summary.slice(0, 1000),
                        pathname: pathname ?? null,
                      });
                    if (flagErr) {
                      console.error('[Taco] flag_unhandled_request insert failed', flagErr);
                    } else {
                      console.log('[Taco] unhandled request logged:', summary.slice(0, 80));
                    }
                  } catch (flagErr) {
                    console.error('[Taco] flag_unhandled_request threw', flagErr);
                  }
                })();
              }
              result = { acknowledged: true };
              break;
            }
            default:
              result = { error: `Unknown tool: ${tc.function.name}` };
          }
        } catch (err) {
          console.error('[Taco] tool error', tc.function.name, err);
          result = { error: err instanceof Error ? err.message : 'Tool execution failed' };
        }

        // Collect any inline navigation suggestions returned by write/create tools
        if (result && typeof result === 'object' && Array.isArray((result as any).navigation)) {
          const inlineNav = (result as any).navigation as NavigationSuggestion[];
          const valid = inlineNav.filter(
            (s) => typeof s.label === 'string' && typeof s.href === 'string' && s.href.startsWith('/'),
          );
          collectedSuggestions.push(...valid);
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
