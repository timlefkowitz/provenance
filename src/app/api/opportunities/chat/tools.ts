import type OpenAI from 'openai';

/**
 * Tool: query the platform's own open_calls table for matching opportunities.
 * The agent calls this first before searching the web, so curated platform
 * data is always surfaced first.
 */
export const SEARCH_OPEN_CALLS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_open_calls',
    description:
      'Search the platform database for open calls that are currently accepting submissions. Use this first before searching the web. Returns exhibitions, open calls, and opportunities from galleries on Provenance.',
    parameters: {
      type: 'object',
      properties: {
        medium: {
          type: 'string',
          description:
            'Filter by art medium. One of: painting, oil, sculpture, photography, printmaking, mixed-media, digital, drawing, installation, other. Omit to return all mediums.',
        },
        location_filter: {
          type: 'string',
          enum: ['my', 'none', 'all'],
          description:
            '"my" = only open calls where the artist location matches, "none" = no location restriction, "all" = all open calls regardless of location.',
        },
      },
      required: [],
    },
  },
};

/**
 * Tool: save a curated list of recommended opportunities to the artist's profile.
 * The agent calls this after gathering results from the platform DB and/or web.
 */
export const RECOMMEND_OPPORTUNITIES_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'recommend_opportunities',
    description:
      'Save a list of recommended grants, open calls, or residencies for the artist. Call this when you have concrete opportunities to present. Include all relevant ones you found.',
    parameters: {
      type: 'object',
      properties: {
        opportunities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Grant, open call, or residency name' },
              type: {
                type: 'string',
                enum: ['grant', 'open_call', 'residency'],
                description: 'Category of opportunity',
              },
              description: { type: 'string', description: 'Brief description of the opportunity' },
              deadline: {
                type: 'string',
                description: 'Application deadline in YYYY-MM-DD format if known',
              },
              amount: {
                type: 'string',
                description: 'Award or stipend amount, e.g. "$5,000" or "€2,000 + housing"',
              },
              eligible_locations: {
                type: 'array',
                items: { type: 'string' },
                description: 'Locations where applicants must be based. Empty array = worldwide.',
              },
              url: { type: 'string', description: 'Application or information URL' },
              discipline: {
                type: 'array',
                items: { type: 'string' },
                description: 'Relevant art disciplines, e.g. ["painting", "sculpture"]',
              },
            },
            required: ['name', 'type'],
          },
        },
      },
      required: ['opportunities'],
    },
  },
};

export const ALL_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  SEARCH_OPEN_CALLS_TOOL,
  RECOMMEND_OPPORTUNITIES_TOOL,
];
