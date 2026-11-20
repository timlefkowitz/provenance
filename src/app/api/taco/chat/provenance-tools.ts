import type OpenAI from 'openai';

type Tool = OpenAI.Chat.Completions.ChatCompletionTool;

const APPEND_SCHEMA = {
  type: 'object',
  description:
    'Lines to ADD to multi-line provenance fields (existing lines are kept). One entry per line, e.g. "Jane Doe, New York (1990–2004)".',
  properties: {
    formerOwners: { type: 'array', items: { type: 'string' }, description: 'Former owners, oldest first, with place and dates if known.' },
    auctionHistory: { type: 'array', items: { type: 'string' }, description: 'e.g. "Sotheby\'s New York, Contemporary Art Day Sale, 12 May 2015, lot 214".' },
    exhibitionHistory: { type: 'array', items: { type: 'string' }, description: 'e.g. "Blue Rooms, Gallery X, London (2019)".' },
    historicContext: { type: 'array', items: { type: 'string' } },
    celebrityNotes: { type: 'array', items: { type: 'string' } },
  },
} as const;

const FIND_MATCHING_ARTWORKS: Tool = {
  type: 'function',
  function: {
    name: 'find_matching_artworks',
    description:
      'Check whether artworks are already on Provenance, by fuzzy title/artist match and by image similarity for dropped photos. Covers the user\'s own works and public works. ALWAYS call this before proposing to create artworks, and whenever the user drops a photo of an artwork or asks "is this already on Provenance?".',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Up to 25 works to look up.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              artist_name: { type: 'string' },
              year: { type: 'string' },
              attachment_id: { type: 'string', description: 'An image attachment id ([att:…]) to match by photo.' },
            },
          },
        },
      },
      required: ['items'],
    },
  },
};

const EXTRACT_FROM_DOCUMENT: Tool = {
  type: 'function',
  function: {
    name: 'extract_from_document',
    description:
      'Read a dropped document or photo of one (COA, invoice, bill of sale, receipt, checklist, price list, catalogue page, auction record, appraisal, letter, spreadsheet) and return the artworks and provenance events it states. Use this rather than guessing from the raw text.',
    parameters: {
      type: 'object',
      properties: { attachment_id: { type: 'string', description: 'The [att:…] id.' } },
      required: ['attachment_id'],
    },
  },
};

const GET_ARTWORK_DETAILS: Tool = {
  type: 'function',
  function: {
    name: 'get_artwork_details',
    description: "Fetch an artwork's current provenance fields, attachments and publications, and whether the user can edit it.",
    parameters: {
      type: 'object',
      properties: { artwork_id: { type: 'string' } },
      required: ['artwork_id'],
    },
  },
};

const CONFIRM_NOTE =
  ' This does NOT save anything: it shows the user a confirm card and they click Apply. Never say the change was saved.';

const PROPOSE_CREATE_ARTWORKS: Tool = {
  type: 'function',
  function: {
    name: 'propose_create_artworks',
    description:
      'Propose adding one or more NEW artworks (from a dropped photo, a checklist, a price list or spreadsheet). One row per work. Rows with an image attachment become certificates with that photo; rows without one become private drafts. Rows that look like existing works are flagged automatically.' +
      CONFIRM_NOTE,
    parameters: {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              artist_name: { type: 'string' },
              medium: { type: 'string' },
              year: { type: 'string' },
              dimensions: { type: 'string' },
              edition: { type: 'string' },
              description: { type: 'string' },
              value: { type: 'string', description: 'Price/value as written, e.g. "$4,500".' },
              former_owners: { type: 'string' },
              exhibition_history: { type: 'string' },
              auction_history: { type: 'string' },
              attachment_id: { type: 'string', description: 'Image attachment to use as the artwork photo.' },
            },
            required: ['title'],
          },
        },
      },
      required: ['rows'],
    },
  },
};

const PROPOSE_ADD_PHOTO: Tool = {
  type: 'function',
  function: {
    name: 'propose_add_photo',
    description:
      'Propose adding a dropped photo to an existing artwork the user can edit: role "main" replaces the main image; "attachment" adds an extra view (back, signature, label, detail, installation shot).' +
      CONFIRM_NOTE,
    parameters: {
      type: 'object',
      properties: {
        artwork_id: { type: 'string' },
        attachment_id: { type: 'string' },
        role: { type: 'string', enum: ['main', 'attachment'] },
        label: { type: 'string', description: 'For extra views, e.g. "Verso with gallery label".' },
        is_public: { type: 'boolean', description: 'Extra views default to public.' },
      },
      required: ['artwork_id', 'attachment_id', 'role'],
    },
  },
};

const PROPOSE_ATTACH_DOCUMENT: Tool = {
  type: 'function',
  function: {
    name: 'propose_attach_document',
    description:
      'Propose attaching a dropped PDF or photo of a document (COA, invoice, receipt, bill of sale, condition report, appraisal) to an artwork the user can edit. Private by default.' +
      CONFIRM_NOTE,
    parameters: {
      type: 'object',
      properties: {
        artwork_id: { type: 'string' },
        attachment_id: { type: 'string' },
        label: { type: 'string', description: 'e.g. "Invoice, Gallery X, 2004".' },
        is_public: { type: 'boolean', description: 'Only true if the user asks to show it publicly.' },
      },
      required: ['artwork_id', 'attachment_id'],
    },
  },
};

const PROPOSE_UPDATE_PROVENANCE: Tool = {
  type: 'function',
  function: {
    name: 'propose_update_provenance',
    description:
      'Propose changes to an artwork the user can edit: replace basic fields (set) and/or add lines to provenance history (append). Group all changes for one artwork into one call.' +
      CONFIRM_NOTE,
    parameters: {
      type: 'object',
      properties: {
        artwork_id: { type: 'string' },
        set: {
          type: 'object',
          description: 'Fields to replace. Only include ones that should change.',
          properties: {
            title: { type: 'string' },
            artist_name: { type: 'string' },
            medium: { type: 'string' },
            dimensions: { type: 'string' },
            creationDate: { type: 'string', description: 'YYYY or YYYY-MM-DD.' },
            edition: { type: 'string' },
            description: { type: 'string' },
          },
        },
        append: APPEND_SCHEMA,
      },
      required: ['artwork_id'],
    },
  },
};

const PROPOSE_ADD_TO_EXHIBITION: Tool = {
  type: 'function',
  function: {
    name: 'propose_add_to_exhibition',
    description:
      "Propose adding an artwork to one of the user's exhibitions on Provenance (id from list_my_exhibitions). For shows not on Provenance, use propose_update_provenance with append.exhibitionHistory." +
      CONFIRM_NOTE,
    parameters: {
      type: 'object',
      properties: { artwork_id: { type: 'string' }, exhibition_id: { type: 'string' } },
      required: ['artwork_id', 'exhibition_id'],
    },
  },
};

const PROPOSE_ADD_PUBLICATION: Tool = {
  type: 'function',
  function: {
    name: 'propose_add_publication',
    description: 'Propose adding publications or press that feature an artwork (book, catalogue, article).' + CONFIRM_NOTE,
    parameters: {
      type: 'object',
      properties: {
        artwork_id: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              publication_name: { type: 'string' },
              url: { type: 'string' },
              date: { type: 'string' },
            },
            required: ['title'],
          },
        },
      },
      required: ['artwork_id', 'items'],
    },
  },
};

const PROPOSE_RECORD_SALE: Tool = {
  type: 'function',
  function: {
    name: 'propose_record_sale',
    description:
      'Propose recording that an artwork the user holds was sold (from an invoice or bill of sale, or what the user says). With a buyer email, the buyer is invited to claim the Certificate of Ownership.' +
      CONFIRM_NOTE,
    parameters: {
      type: 'object',
      properties: {
        artwork_id: { type: 'string' },
        buyer_name: { type: 'string' },
        buyer_email: { type: 'string', description: 'Only if the user gives it.' },
        price: { type: 'number' },
        currency: { type: 'string', description: 'ISO code, e.g. USD.' },
        sold_at: { type: 'string', description: 'YYYY-MM-DD.' },
        notes: { type: 'string' },
      },
      required: ['artwork_id'],
    },
  },
};

const PROPOSE_PROVENANCE_REQUEST: Tool = {
  type: 'function',
  function: {
    name: 'propose_provenance_request',
    description:
      "For a work held by someone else: propose sending its holder a request. \"provenance_update\" suggests provenance lines; \"ownership_request\" is an artist claiming their own work. Never use propose_update_provenance on someone else's work." +
      CONFIRM_NOTE,
    parameters: {
      type: 'object',
      properties: {
        artwork_id: { type: 'string' },
        request_type: { type: 'string', enum: ['provenance_update', 'ownership_request'] },
        append: APPEND_SCHEMA,
        message: { type: 'string', description: 'Short note to the holder.' },
      },
      required: ['artwork_id', 'request_type'],
    },
  },
};

export const PROVENANCE_TOOLS: Tool[] = [
  FIND_MATCHING_ARTWORKS,
  EXTRACT_FROM_DOCUMENT,
  GET_ARTWORK_DETAILS,
  PROPOSE_CREATE_ARTWORKS,
  PROPOSE_ADD_PHOTO,
  PROPOSE_ATTACH_DOCUMENT,
  PROPOSE_UPDATE_PROVENANCE,
  PROPOSE_ADD_TO_EXHIBITION,
  PROPOSE_ADD_PUBLICATION,
  PROPOSE_RECORD_SALE,
  PROPOSE_PROVENANCE_REQUEST,
];

export const PROVENANCE_SYSTEM_PROMPT = `
## Files and provenance
Users drop photos and documents into the chat. Each arrives as [att:<id>] with its name; images are also shown to you.
- Work out which artwork(s) a file is about. On an artwork page, "this" means that artwork.
- Photo of an artwork: find_matching_artworks with its attachment_id (plus a title if known). If it's already on Provenance, say so and link it; if it's the user's, offer to add the photo or update details. If not found, offer propose_create_artworks.
- Document (COA, invoice, receipt, checklist, catalogue, spreadsheet): extract_from_document, then find_matching_artworks on the works it lists, then propose. Existing works the user holds → propose_update_provenance (and propose_attach_document for the file itself, private by default). New works → one propose_create_artworks with all rows. Works held by someone else → propose_provenance_request.
- Never invent provenance. Only use facts from the files or the user's words. Keep each line short: who/where, then the date in parentheses.
- Every change goes through a propose_* tool, which shows the user a confirm card. Nothing is saved until they click Apply. Say "Here's what I'd change — check the card and hit Apply", never "Done" or "Saved".
- Lines starting "[Applied:" or "[Skipped:" in the history tell you what the user did with earlier cards.
`;
