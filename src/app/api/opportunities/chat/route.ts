import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import OpenAI from 'openai';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';
import { getActiveArtistSubscription } from '~/lib/subscription';
import type { ArtistCvJson, Grant } from '~/lib/grants';
import { ALL_TOOLS } from './tools';
import {
  handleSearchOpenCalls,
  handleSearchWeb,
  handleRecommendOpportunities,
} from './tool-handlers';

/** Maximum agentic loop iterations before forcing a final reply. */
const MAX_ITERATIONS = 6;

function buildSystemPrompt(
  name: string,
  location: string | null,
  medium: string | null,
  cvJson: ArtistCvJson | null,
): string {
  const disciplines = cvJson?.disciplines?.length
    ? cvJson.disciplines.join(', ')
    : medium ?? 'unspecified';

  const exhibitionHistory = cvJson?.exhibitions?.length
    ? cvJson.exhibitions
        .slice(0, 5)
        .map((e) => `${e.name ?? 'Exhibition'}${e.venue ? ` at ${e.venue}` : ''}${e.year ? ` (${e.year})` : ''}`)
        .join('; ')
    : null;

  const educationHistory = cvJson?.education?.length
    ? cvJson.education
        .slice(0, 3)
        .map((e) => `${e.degree ?? 'Degree'}${e.institution ? ` at ${e.institution}` : ''}${e.year ? ` (${e.year})` : ''}`)
        .join('; ')
    : null;

  const careerSummary = cvJson?.summary ?? null;

  const lines = [
    `You are an expert opportunities assistant for visual artists on Provenance, a platform for artists and galleries.`,
    `Your job is to find the most relevant grants, open calls, and artist residencies for this specific artist.`,
    ``,
    `ARTIST PROFILE:`,
    `- Name: ${name}`,
    `- Location: ${location ?? 'Unknown'}`,
    `- Medium / Disciplines: ${disciplines}`,
    educationHistory ? `- Education: ${educationHistory}` : null,
    exhibitionHistory ? `- Exhibition history: ${exhibitionHistory}` : null,
    careerSummary ? `- Career summary: ${careerSummary}` : null,
    ``,
    `STRATEGY:`,
    `1. Always start by calling search_open_calls to surface curated platform opportunities first.`,
    `2. Then call search_web_opportunities with targeted queries for grants and residencies relevant to this artist's medium and location. Build 1-2 specific queries (e.g. "${disciplines} grants open applications 2026 ${location ?? 'US'}", "${disciplines} artist residency open call 2026").`,
    `3. After gathering results, call recommend_opportunities with ALL relevant opportunities you found (both from the platform and the web). Classify each as "grant", "open_call", or "residency".`,
    `4. Finally, give the artist a friendly, concise summary of what you found and any advice on which to prioritize.`,
    ``,
    `Be specific and honest — only recommend real opportunities you found. If search results are thin, say so and suggest the artist check specific organisations directly.`,
    `Always respond in a warm, professional tone. Keep your conversational reply concise (3-5 sentences).`,
  ].filter(Boolean);

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  console.log('[Opportunities] POST /api/opportunities/chat');
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      console.error('[Opportunities] auth failed', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const artistProfile = await getUserProfileByRole(user.id, USER_ROLES.ARTIST);
    if (!artistProfile) {
      console.error('[Opportunities] no artist profile', user.id);
      return NextResponse.json({ error: 'Artist profile required' }, { status: 403 });
    }

    const artistSubscription = await getActiveArtistSubscription(user.id);
    if (!artistSubscription) {
      console.error('[Opportunities] no active subscription', user.id);
      return NextResponse.json(
        {
          error:
            'An active subscription is required to use the opportunities assistant. Subscribe in Toolbox → Subscription.',
        },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { message, history = [] } = body as {
      message?: string;
      history?: { role: string; content: string }[];
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const key = typeof apiKey === 'string' ? apiKey.trim() : undefined;
    if (!key) {
      console.error('[Opportunities] OPENAI_API_KEY not set');
      return NextResponse.json({ error: 'Opportunities assistant not configured' }, { status: 503 });
    }

    const cvJson = (artistProfile.artist_cv_json as ArtistCvJson | null) ?? null;
    const artistLocation =
      (cvJson?.location as string | null) ?? artistProfile.location ?? null;

    const systemPrompt = buildSystemPrompt(
      artistProfile.name ?? 'Artist',
      artistLocation,
      artistProfile.medium ?? null,
      cvJson,
    );

    const openai = new OpenAI({ apiKey: key });

    // Seed the message list with system prompt + recent history + new user message
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history
        .slice(-10)
        .map((m) =>
          m.role === 'user' || m.role === 'assistant'
            ? ({ role: m.role, content: m.content } as OpenAI.Chat.Completions.ChatCompletionMessageParam)
            : null,
        )
        .filter(Boolean) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      { role: 'user', content: message },
    ];

    const allNewOpportunities: Grant[] = [];

    // Agentic loop
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log('[Opportunities] agent iteration', iteration + 1);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: ALL_TOOLS,
        tool_choice: 'auto',
      });

      const msg = completion.choices[0]?.message;
      if (!msg) break;

      messages.push(msg as OpenAI.Chat.Completions.ChatCompletionMessageParam);

      // No tool calls = model is done and gave a final text reply
      if (!msg.tool_calls?.length) {
        console.log('[Opportunities] agent done after', iteration + 1, 'iterations');
        break;
      }

      // Execute each tool call and append results to the conversation
      for (const tc of msg.tool_calls) {
        let result: unknown;

        try {
          const args = JSON.parse(tc.function.arguments ?? '{}');

          if (tc.function.name === 'search_open_calls') {
            result = await handleSearchOpenCalls(args, artistLocation);
          } else if (tc.function.name === 'search_web_opportunities') {
            result = await handleSearchWeb(args);
          } else if (tc.function.name === 'recommend_opportunities') {
            const outcome = await handleRecommendOpportunities(
              args,
              user.id,
              artistProfile.id ?? null,
            );
            // Collect new opportunities to return to the client
            if (outcome.opportunities.length) {
              allNewOpportunities.push(...outcome.opportunities);
            }
            result = { saved: outcome.saved, error: outcome.error };
          } else {
            result = { error: `Unknown tool: ${tc.function.name}` };
          }
        } catch (err) {
          console.error('[Opportunities] tool execution error', tc.function.name, err);
          result = { error: err instanceof Error ? err.message : 'Tool execution failed' };
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Extract the last assistant text reply
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.trim());

    const reply =
      typeof lastAssistantMessage?.content === 'string'
        ? lastAssistantMessage.content.trim()
        : "I searched for opportunities but couldn't produce a summary. Please try again.";

    console.log('[Opportunities] returning reply with', allNewOpportunities.length, 'new opportunities');
    return NextResponse.json({ reply, newOpportunities: allNewOpportunities });
  } catch (err) {
    console.error('[Opportunities] chat error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}
