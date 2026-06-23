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

/**
 * Tool: draft a grant proposal document and save it to the artist's account.
 * Called when the user asks Taco to write / draft a proposal or application.
 */
export const DRAFT_PROPOSAL_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'draft_proposal',
    description:
      'Create a draft grant proposal document for the artist. Call this when the artist asks you to draft, write, or help with a grant application or proposal. Use your knowledge of the artist profile and the specific grant to write a compelling, personalised proposal with sections: project summary, artistic statement, project description, budget overview, and timeline. Save the draft so the artist can open and edit it.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the proposal document, e.g. "Application for NEA Individual Artist Grant"',
        },
        grant_id: {
          type: 'string',
          description: 'The ID of the artist_grants row this proposal is for, if known. Omit if unknown.',
        },
        grant_name: {
          type: 'string',
          description: 'Human-readable name of the grant or opportunity this proposal is for.',
        },
        project_summary: {
          type: 'string',
          description: 'A concise 2-3 sentence executive summary of the proposed project.',
        },
        artistic_statement: {
          type: 'string',
          description: 'A 1-2 paragraph artistic statement tailored to this grant\'s focus.',
        },
        project_description: {
          type: 'string',
          description: 'Detailed description of the proposed project (3-5 paragraphs).',
        },
        budget_overview: {
          type: 'string',
          description: 'High-level budget breakdown — line items and total.',
        },
        timeline: {
          type: 'string',
          description: 'Project timeline with key milestones.',
        },
      },
      required: ['title'],
    },
  },
};

export const ALL_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  SEARCH_OPEN_CALLS_TOOL,
  RECOMMEND_OPPORTUNITIES_TOOL,
  DRAFT_PROPOSAL_TOOL,
];
