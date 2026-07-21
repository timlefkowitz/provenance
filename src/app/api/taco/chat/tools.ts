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

/* ========================================================================== */
/*  PHASE 1 — Read tools                                                     */
/* ========================================================================== */

const GET_MY_GRANTS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_my_grants',
    description:
      "Fetch the logged-in artist's saved grants and opportunities from Provenance. Returns grants with deadlines, amounts, and bookmark status. Call this when the user asks about their saved grants, bookmarks, or what opportunities they're tracking.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

const GET_MY_PROFILE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_my_profile',
    description:
      "Fetch the current user's profile(s) — bio, medium, location, website, CV status, and onboarding goals. Call this when writing content for the user, personalizing advice, or when the user asks what their profile says.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

const GET_MY_SALES_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_my_sales',
    description:
      "Fetch the user's sales history from the Provenance sales ledger. Returns individual sales, total revenue, and count. Call this when asked about sales, revenue, pricing history, or market performance.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

const GET_PORTAL_STATS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_portal_stats',
    description:
      "Fetch the user's entity stats — market cap, artwork count, exhibition count, museum presence, and rarity index. Call when asked about their market position, career overview, or portfolio statistics.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

const GET_OPEN_CALLS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_open_calls',
    description:
      "Fetch open calls currently accepting submissions, filtered by the artist's medium and location. Call when the user asks about open calls, submission opportunities, or exhibitions they can apply to.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

const SUMMARIZE_PRACTICE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'summarize_practice',
    description:
      "Generate a 2-paragraph AI summary of the artist's practice, drawing on their profile, CV, collection, and exhibitions. Call when the user asks for an overview of their practice or career.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

/* ========================================================================== */
/*  PHASE 2 — Write / create tools                                           */
/* ========================================================================== */

const CREATE_EXHIBITION_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_exhibition',
    description:
      'Create a new exhibition in Provenance for the current user. Gather the title and start date from the user before calling. Confirm details with the user first.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Exhibition title (required).' },
        start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format (required).' },
        description: { type: 'string', description: 'Optional exhibition description.' },
        location: { type: 'string', description: 'Optional venue name or city.' },
        end_date: { type: 'string', description: 'Optional end date in YYYY-MM-DD format.' },
      },
      required: ['title', 'start_date'],
    },
  },
};

const ADD_CV_ENTRY_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'add_cv_entry',
    description:
      "Add a new entry to the artist's CV — an exhibition, education credential, award, residency, or publication. Ask the user for the entry type, name, venue/institution, and year before calling.",
    parameters: {
      type: 'object',
      properties: {
        entry_type: {
          type: 'string',
          enum: ['exhibition', 'education', 'award', 'residency', 'publication'],
          description: 'The type of CV entry.',
        },
        name: { type: 'string', description: 'Exhibition name, degree, award name, residency name, or publication title.' },
        venue_or_institution: { type: 'string', description: 'Gallery, museum, school, or publisher.' },
        year: { type: 'string', description: 'Year (e.g. "2024").' },
        description: { type: 'string', description: 'Optional short description.' },
      },
      required: ['entry_type', 'name'],
    },
  },
};

const UPDATE_ARTIST_BIO_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'update_artist_bio',
    description:
      "Save a new bio text to the user's artist (or gallery) profile. Use this after generating or editing a bio. Confirm with the user before saving.",
    parameters: {
      type: 'object',
      properties: {
        bio: { type: 'string', description: 'The bio text to save.' },
        role: {
          type: 'string',
          enum: ['artist', 'gallery', 'collector'],
          description: 'Which profile to update. Defaults to artist.',
        },
      },
      required: ['bio'],
    },
  },
};

const SEARCH_PRESS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_press',
    description:
      "Search the web for press coverage, interviews, and reviews about the artist. Returns a numbered list of press items the user can select to add to their profile. Call when the user asks to find press, coverage, or media mentions.",
    parameters: {
      type: 'object',
      properties: {
        artist_name: {
          type: 'string',
          description: "Artist name to search for. Omit to use the user's profile name.",
        },
      },
      required: [],
    },
  },
};

const SAVE_PRESS_TO_PROFILE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'save_press_to_profile',
    description:
      "Save selected press items to the user's profile news_publications field. Call this after search_press when the user has selected which items to add.",
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
              publication_name: { type: 'string' },
              date: { type: 'string' },
            },
            required: ['title', 'url'],
          },
          description: 'Press items to save.',
        },
      },
      required: ['items'],
    },
  },
};

/* ========================================================================== */
/*  PHASE 3 — AI writing tools                                               */
/* ========================================================================== */

const DRAFT_ARTIST_STATEMENT_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'draft_artist_statement',
    description:
      "Write a 300-word artist statement using the user's profile, bio, and CV. Call when the user asks for an artist statement, statement of practice, or writing help for their practice.",
    parameters: {
      type: 'object',
      properties: {
        focus: {
          type: 'string',
          description: 'Optional focus or emphasis, e.g. "abstract painting", "community practice", "a specific grant".',
        },
      },
      required: [],
    },
  },
};

const DRAFT_EXHIBITION_TEXT_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'draft_exhibition_text',
    description:
      "Write a press release, wall text, or catalogue note for an exhibition. Call when the user asks to write copy for a show. Fetches the exhibition from Provenance if an ID or title is provided.",
    parameters: {
      type: 'object',
      properties: {
        exhibition_id: { type: 'string', description: 'Exhibition ID if known.' },
        exhibition_title: { type: 'string', description: 'Exhibition title to search for if ID not known.' },
        format: {
          type: 'string',
          enum: ['press_release', 'wall_text', 'catalogue_note'],
          description: 'Format of text to produce. Default: press_release.',
        },
      },
      required: [],
    },
  },
};

const DRAFT_OPEN_CALL_SUBMISSION_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'draft_open_call_submission',
    description:
      "Write a tailored 200-word artist submission statement for a specific open call. Call when the user asks to write or draft an open call application or submission.",
    parameters: {
      type: 'object',
      properties: {
        open_call_id: { type: 'string', description: 'Open call ID if known.' },
        open_call_title: { type: 'string', description: 'Open call or exhibition title if ID not known.' },
      },
      required: [],
    },
  },
};

const DRAFT_COLLECTOR_OUTREACH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'draft_collector_outreach',
    description:
      "Write a short personalized outreach email from the artist to a collector or contact. Call when the user asks to draft an email, message, or outreach to a collector.",
    parameters: {
      type: 'object',
      properties: {
        contact_name: { type: 'string', description: 'The collector or contact name.' },
        context: {
          type: 'string',
          description: 'Purpose of the outreach, e.g. "following up on their interest in my painting", "introducing new work from my recent show".',
        },
      },
      required: ['contact_name'],
    },
  },
};

const GENERATE_WEBSITE_BIO_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'generate_website_bio',
    description:
      "Write a website-optimized bio for the artist in the third person. Short (~100 words) or medium (~250 words). Call when the user asks for a website bio, About page text, or short biography.",
    parameters: {
      type: 'object',
      properties: {
        length: {
          type: 'string',
          enum: ['short', 'medium'],
          description: 'Bio length: short (~100 words) or medium (~250 words). Default: short.',
        },
      },
      required: [],
    },
  },
};

const SUGGEST_PRICING_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'suggest_pricing',
    description:
      "Estimate a price range for one of the user's artworks using comparable sales, exhibition history, and market signals. Call when the user asks how to price a specific artwork or what it might be worth.",
    parameters: {
      type: 'object',
      properties: {
        artwork_title: { type: 'string', description: 'Title (or partial title) of the artwork to price.' },
      },
      required: ['artwork_title'],
    },
  },
};

/* ========================================================================== */
/*  PHASE 4 — Extended tools                                                 */
/* ========================================================================== */

const GET_COLLECTOR_CONTACTS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_collector_contacts',
    description:
      "Fetch the user's CRM contacts and collector leads from the Provenance portal. Returns names, emails, stage, and notes. Call when the user asks about their contacts, collectors, or who to follow up with.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

const CREATE_ARTWORK_DRAFT_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_artwork_draft',
    description:
      "Create a new draft artwork record in Provenance. Gather the title from the user at minimum. The artwork will be saved as a draft so they can add images and details later.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Artwork title (required).' },
        medium: { type: 'string', description: 'Medium, e.g. "oil on canvas".' },
        year: { type: 'string', description: 'Year created, e.g. "2024".' },
        dimensions: { type: 'string', description: 'Dimensions, e.g. "60 × 80 cm".' },
        description: { type: 'string', description: 'Brief description or notes.' },
      },
      required: ['title'],
    },
  },
};

const SEARCH_COMPARABLE_SALES_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_comparable_sales',
    description:
      "Search the Provenance sales ledger for comparable sales by medium or artist name. Returns recent prices and an average. Call when the user asks about market pricing, what similar works sell for, or comparable sales data.",
    parameters: {
      type: 'object',
      properties: {
        medium: { type: 'string', description: 'Art medium to filter by, e.g. "painting", "photography".' },
        artist_name: { type: 'string', description: 'Artist name to find their sales record.' },
      },
      required: [],
    },
  },
};

const FIND_GRANTS_FOR_ME_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'find_grants_for_me',
    description:
      "Find the most relevant unseen/unbookmarked grants from the artist's saved list, ranked by relevance to their medium and urgency of deadline. Call when the user asks Taco to find grants, recommend opportunities, or show what they should apply to next.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

const GET_MY_WEBSITE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_my_website',
    description:
      "Fetch the user's creator website configuration from Provenance — handle, published state, template, colors, font, text color, tagline, sections, and the valid option lists so you can make valid choices when updating. Call this before update_my_website so you have the current state.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

const UPDATE_MY_WEBSITE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'update_my_website',
    description:
      "Update the user's creator website configuration. Only pass fields the user wants to change — omitted fields keep their current values. ALWAYS call get_my_website first to know the current state. Confirm the changes with the user before calling this tool.",
    parameters: {
      type: 'object',
      properties: {
        profile_id: { type: 'string', description: 'The profile_id returned by get_my_website. Required.' },
        handle: { type: 'string', description: 'URL handle (slug). Lowercase letters, numbers, hyphens. e.g. "jane-doe".' },
        template_id: {
          type: 'string',
          enum: ['editorial','studio','atelier','whitecube','vitrine','salon','pavilion','cabinet','folio','index','concrete','lightbox','noir','manifesto','billboard','shopfront','poster','annum','chronicle','ledger','broadside'],
          description: 'Visual template to use.',
        },
        accent: { type: 'string', description: 'Accent color — a key from the valid accent list returned by get_my_website, or a hex color like #C4472A.' },
        surface_color: { type: 'string', enum: ['parchment','cream','white','slate','charcoal','ink'], description: 'Background surface key.' },
        font_pairing: { type: 'string', description: 'Font pairing key from the valid list returned by get_my_website.' },
        text_color: { type: 'string', description: 'Hex color for body/heading text, e.g. "#1A1A1A". Pass null to reset to surface default.' },
        tagline: { type: 'string', description: 'Hero tagline shown on the site.' },
        display_name: { type: 'string', description: 'Display name override for the site header/logo area.' },
        about_override: { type: 'string', description: 'Bio text override. Leave empty to use profile bio.' },
        sections: {
          type: 'object',
          description: 'Section visibility toggles. Only include keys the user wants to change.',
          properties: {
            artworks: { type: 'boolean' },
            exhibitions: { type: 'boolean' },
            press: { type: 'boolean' },
            bio: { type: 'boolean' },
            contact: { type: 'boolean' },
          },
        },
      },
      required: ['profile_id'],
    },
  },
};

const PUBLISH_MY_WEBSITE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'publish_my_website',
    description:
      "Publish or unpublish the user's creator website. Requires the site to exist and have a handle. Confirm with the user before calling.",
    parameters: {
      type: 'object',
      properties: {
        profile_id: { type: 'string', description: 'The profile_id of the site to publish/unpublish.' },
        published: { type: 'boolean', description: 'true to publish, false to unpublish.' },
      },
      required: ['profile_id', 'published'],
    },
  },
};

const FLAG_UNHANDLED_REQUEST_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'flag_unhandled_request',
    description:
      'Call this tool when the user asks you to do something you genuinely cannot do — a feature that does not exist yet, an action outside your capabilities, or something that would require platform functionality not currently available. Do NOT call it for things you can answer from knowledge; only use it for real capability gaps. This records the request for the product team.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description:
            'A concise 1-2 sentence description of what the user wanted that you could not provide. Be specific — e.g. "User asked to bulk-import artworks from a CSV file" rather than "user asked for something I can\'t do".',
        },
      },
      required: ['summary'],
    },
  },
};

export const ALL_TACO_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  // Original tools
  SEARCH_ARTWORKS_TOOL,
  SEARCH_ARTISTS_TOOL,
  GET_MY_COLLECTION_TOOL,
  LIST_MY_EXHIBITIONS_TOOL,
  SUGGEST_NAVIGATION_TOOL,
  // Phase 1 — reads
  GET_MY_GRANTS_TOOL,
  GET_MY_PROFILE_TOOL,
  GET_MY_SALES_TOOL,
  GET_PORTAL_STATS_TOOL,
  GET_OPEN_CALLS_TOOL,
  SUMMARIZE_PRACTICE_TOOL,
  // Phase 2 — writes
  CREATE_EXHIBITION_TOOL,
  ADD_CV_ENTRY_TOOL,
  UPDATE_ARTIST_BIO_TOOL,
  SEARCH_PRESS_TOOL,
  SAVE_PRESS_TO_PROFILE_TOOL,
  // Phase 3 — AI writing
  DRAFT_ARTIST_STATEMENT_TOOL,
  DRAFT_EXHIBITION_TEXT_TOOL,
  DRAFT_OPEN_CALL_SUBMISSION_TOOL,
  DRAFT_COLLECTOR_OUTREACH_TOOL,
  GENERATE_WEBSITE_BIO_TOOL,
  SUGGEST_PRICING_TOOL,
  // Phase 4 — extended
  GET_COLLECTOR_CONTACTS_TOOL,
  CREATE_ARTWORK_DRAFT_TOOL,
  SEARCH_COMPARABLE_SALES_TOOL,
  FIND_GRANTS_FOR_ME_TOOL,
  // Website editing
  GET_MY_WEBSITE_TOOL,
  UPDATE_MY_WEBSITE_TOOL,
  PUBLISH_MY_WEBSITE_TOOL,
  // Meta
  FLAG_UNHANDLED_REQUEST_TOOL,
];
