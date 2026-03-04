import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import OpenAI from 'openai';
import { getUserProfileByRole as getProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { saveArtistGrants } from '~/app/grants/_actions/save-artist-grants';
import { USER_ROLES } from '~/lib/user-roles';
import type { Grant } from '~/lib/grants';

const RECOMMEND_GRANTS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'recommend_grants',
    description: 'Call this when you have a list of grant recommendations to show the user. Include all relevant grants you found.',
    parameters: {
      type: 'object',
      properties: {
        grants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Grant or program name' },
              description: { type: 'string', description: 'Brief description' },
              deadline: { type: 'string', description: 'Deadline date YYYY-MM-DD if known' },
              amount: { type: 'string', description: 'Award amount e.g. $5,000' },
              eligible_locations: {
                type: 'array',
                items: { type: 'string' },
                description: 'Locations where applicants can be based',
              },
              url: { type: 'string', description: 'Application or info URL' },
              discipline: {
                type: 'array',
                items: { type: 'string' },
                description: 'Art disciplines (e.g. painting, sculpture)',
              },
            },
            required: ['name'],
          },
        },
      },
      required: ['grants'],
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const artistProfile = await getProfileByRole(user.id, USER_ROLES.ARTIST);
    if (!artistProfile) {
      return NextResponse.json({ error: 'Artist profile required' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { message, history = [] } = body as { message?: string; history?: { role: string; content: string }[] };

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Grant assistant not configured' }, { status: 503 });
    }

    const cvContext = artistProfile.artist_cv_json
      ? JSON.stringify(artistProfile.artist_cv_json)
      : 'No CV on file.';
    const profileContext = `Artist: ${artistProfile.name}. Location: ${artistProfile.location ?? 'unknown'}. Medium: ${artistProfile.medium ?? 'unknown'}.`;

    const systemContent = `You are a helpful grant-finding assistant for visual artists. Use this artist context to recommend relevant grants, residencies, and opportunities.

Artist context (from CV and profile):
${profileContext}

Structured CV data:
${cvContext}

When the user asks for grants or opportunities, search your knowledge for real or representative grants that match their practice and location. When you have specific recommendations, call the recommend_grants function with the list. Always give a short conversational reply in your message as well.`;

    const openai = new OpenAI({ apiKey });
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      ...history.slice(-12).map((m: { role: string; content: string }) =>
        m.role === 'user' || m.role === 'assistant'
          ? { role: m.role as 'user' | 'assistant', content: m.content }
          : null
      ).filter(Boolean) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: [RECOMMEND_GRANTS_TOOL],
      tool_choice: 'auto',
    });

    const choice = completion.choices[0];
    const msg = choice?.message;
    let reply = (msg?.content || '').trim() || 'I couldn’t find specific grants this time. Try asking for a discipline or location.';

    const newGrants: Grant[] = [];
    const toolCalls = msg?.tool_calls;
    if (toolCalls?.length) {
      for (const tc of toolCalls) {
        if (tc.function?.name === 'recommend_grants' && tc.function.arguments) {
          try {
            const args = JSON.parse(tc.function.arguments) as { grants?: Grant[] };
            const grants = args?.grants || [];
            if (grants.length) {
              const toSave = grants.map((g) => ({
                name: g.name || 'Untitled',
                description: g.description ?? null,
                deadline: g.deadline ?? null,
                amount: g.amount ?? null,
                eligible_locations: Array.isArray(g.eligible_locations) ? g.eligible_locations : [],
                url: g.url ?? null,
                discipline: Array.isArray(g.discipline) ? g.discipline : [],
                source: 'openai',
              }));
              const { saved } = await saveArtistGrants(user.id, artistProfile.id, toSave);
              if (saved) {
                newGrants.push(...toSave.map((g) => ({ ...g, eligible_locations: g.eligible_locations || [], discipline: g.discipline || [] })));
              }
            }
          } catch (e) {
            console.error('[grants/chat] parse tool args', e);
          }
        }
      }
    }

    return NextResponse.json({ reply, newGrants });
  } catch (err) {
    console.error('[grants/chat]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
