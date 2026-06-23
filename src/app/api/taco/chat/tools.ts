import type OpenAI from 'openai';

const SEARCH_ARTWORKS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_artworks',
    description:
      'Search the Provenance platform for artworks by title or artist name. Returns public artworks plus the user\'s own. Call this when the user asks about artworks on the platform or wants to look up a specific piece.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query — artwork title, artist name, or keyword.',
        },
      },
      required: ['query'],
    },
  },
};

const SEARCH_ARTISTS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_artists',
    description:
      'Search the Provenance artist registry by name. Returns artist profiles. Use when the user asks about a specific artist or wants to explore the registry.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Artist name or partial name to search for.',
        },
      },
      required: ['query'],
    },
  },
};

const GET_MY_COLLECTION_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_my_collection',
    description:
      "Fetch the logged-in user's own artwork collection from Provenance. Returns a list of their artworks. Call this when the user asks about 'my artworks', 'my collection', 'what do I have', etc.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const LIST_MY_EXHIBITIONS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'list_my_exhibitions',
    description:
      "Fetch the logged-in user's exhibitions from Provenance. Returns exhibition titles and dates. Call this when the user asks about their shows, exhibitions, or upcoming events.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const SUGGEST_NAVIGATION_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'suggest_navigation',
    description:
      'Suggest one or more app pages the user should visit as a next step. The UI will render clickable buttons for each suggestion. Use this when you want to send the user to a relevant part of the app (Grants, Operations, Exhibitions, etc.) rather than describing how to navigate there.',
    parameters: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Short button label, e.g. "Open Grants" or "View my artworks".',
              },
              href: {
                type: 'string',
                description:
                  'App-relative path, e.g. "/grants", "/artworks/my", "/exhibitions", "/operations", "/mailing-list", "/portal/or", "/subscription".',
              },
            },
            required: ['label', 'href'],
          },
          description: 'List of navigation suggestions to offer the user.',
        },
      },
      required: ['suggestions'],
    },
  },
};

export const ALL_TACO_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  SEARCH_ARTWORKS_TOOL,
  SEARCH_ARTISTS_TOOL,
  GET_MY_COLLECTION_TOOL,
  LIST_MY_EXHIBITIONS_TOOL,
  SUGGEST_NAVIGATION_TOOL,
];
