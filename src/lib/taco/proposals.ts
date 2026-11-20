/**
 * Taco proposals: changes Taco suggests that the user applies from a confirm
 * card. Types and pure payload sanitizers shared by the chat handlers, the
 * apply action and the card UI.
 */

export const PROPOSAL_KINDS = [
  'create_artworks',
  'add_photo',
  'attach_document',
  'update_provenance',
  'add_to_exhibition',
  'add_publication',
  'record_sale',
  'provenance_request',
] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export type ProposalStatus = 'pending' | 'applied' | 'partial' | 'skipped' | 'failed';

/** Text fields `update_provenance` may replace outright. */
export const SET_FIELDS = {
  title: 'Title',
  artist_name: 'Artist',
  medium: 'Medium',
  dimensions: 'Dimensions',
  creationDate: 'Date',
  edition: 'Edition',
  description: 'Description',
} as const;
export type SetField = keyof typeof SET_FIELDS;

/** Multi-line history fields `update_provenance` appends lines to. */
export const APPEND_FIELDS = {
  formerOwners: 'Former owners',
  auctionHistory: 'Auction history',
  exhibitionHistory: 'Exhibition history',
  historicContext: 'Historic context',
  celebrityNotes: 'Notable notes',
} as const;
export type AppendField = keyof typeof APPEND_FIELDS;

export const APPEND_FIELD_COLUMNS: Record<AppendField, string> = {
  formerOwners: 'former_owners',
  auctionHistory: 'auction_history',
  exhibitionHistory: 'exhibition_history',
  historicContext: 'historic_context',
  celebrityNotes: 'celebrity_notes',
};

export const SET_FIELD_COLUMNS: Record<SetField, string> = {
  title: 'title',
  artist_name: 'artist_name',
  medium: 'medium',
  dimensions: 'dimensions',
  creationDate: 'creation_date',
  edition: 'edition',
  description: 'description',
};

export type CreateRow = {
  title: string;
  artist_name?: string | null;
  medium?: string | null;
  year?: string | null;
  dimensions?: string | null;
  edition?: string | null;
  description?: string | null;
  value?: string | null;
  former_owners?: string | null;
  exhibition_history?: string | null;
  auction_history?: string | null;
  /** Image attachment to use as the artwork photo. */
  attachment_id?: string | null;
  /** An existing work this row looks like (shown as a warning; the row starts unticked). */
  match?: { artwork_id: string; title: string; confidence: string; mine: boolean } | null;
};

export type ProposalPayload =
  | { kind: 'create_artworks'; rows: CreateRow[] }
  | { kind: 'add_photo'; artwork_id: string; attachment_id: string; role: 'main' | 'attachment'; label: string | null; is_public: boolean }
  | { kind: 'attach_document'; artwork_id: string; attachment_id: string; label: string | null; is_public: boolean }
  | {
      kind: 'update_provenance';
      artwork_id: string;
      set: Partial<Record<SetField, string>>;
      append: Partial<Record<AppendField, string[]>>;
    }
  | { kind: 'add_to_exhibition'; artwork_id: string; exhibition_id: string }
  | {
      kind: 'add_publication';
      artwork_id: string;
      items: { title: string; publication_name: string | null; url: string | null; date: string | null }[];
    }
  | {
      kind: 'record_sale';
      artwork_id: string;
      buyer_name: string | null;
      buyer_email: string | null;
      price: number | null;
      currency: string | null;
      sold_at: string | null;
      notes: string | null;
    }
  | {
      kind: 'provenance_request';
      artwork_id: string;
      request_type: 'provenance_update' | 'ownership_request';
      append: Partial<Record<AppendField, string[]>>;
      message: string;
    };

/** One line on the card: a field going from `before` to `after`. */
export type ProposalChange = {
  key: string;
  label: string;
  before: string | null;
  after: string;
  /** The user may edit `after` before applying. */
  editable: boolean;
};

export type ProposalPreview = {
  title: string;
  summary: string;
  artwork?: { id: string; title: string; image_url: string | null } | null;
  changes: ProposalChange[];
  rows?: (CreateRow & { image_url?: string | null })[];
  attachments?: { name: string; url: string; kind: 'image' | 'document' }[];
  apply_label: string;
};

/** What the chat response carries per proposal, and what the card renders. */
export type TacoProposalView = {
  id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  preview: ProposalPreview;
  result?: ProposalResult | null;
};

export type ProposalResult = {
  ok: boolean;
  message: string;
  navigation?: { label: string; href: string }[];
  rowErrors?: Record<number, string>;
};

/** What the user may change on a card before applying. */
export type ProposalEdits = {
  /** change.key → new `after` text (single-artwork proposals). */
  fields?: Record<string, string>;
  /** Indexes of create_artworks rows to apply. */
  selectedRows?: number[];
  /** create_artworks row index → new title. */
  rowTitles?: Record<number, string>;
};

/* -------------------------------------------------------------------------- */
/*  Sanitizers                                                                */
/* -------------------------------------------------------------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function cleanText(v: unknown, max = 500): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

/** Splits a value (string with newlines, or array) into clean, de-duplicated lines. */
export function cleanLines(v: unknown, maxLines = 30, maxLen = 400): string[] {
  const parts = Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : [];
  const out: string[] = [];
  for (const p of parts) {
    const line = cleanText(p, maxLen);
    if (line && !out.some((o) => o.toLowerCase() === line.toLowerCase())) out.push(line);
    if (out.length >= maxLines) break;
  }
  return out;
}

export function cleanSet(v: unknown): Partial<Record<SetField, string>> {
  const obj = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out: Partial<Record<SetField, string>> = {};
  for (const key of Object.keys(SET_FIELDS) as SetField[]) {
    const val = cleanText(obj[key], key === 'description' ? 4000 : 255);
    if (val) out[key] = val;
  }
  return out;
}

export function cleanAppend(v: unknown): Partial<Record<AppendField, string[]>> {
  const obj = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out: Partial<Record<AppendField, string[]>> = {};
  for (const key of Object.keys(APPEND_FIELDS) as AppendField[]) {
    const lines = cleanLines(obj[key]);
    if (lines.length) out[key] = lines;
  }
  return out;
}

export function cleanCreateRows(v: unknown, max = 200): CreateRow[] {
  const rows = Array.isArray(v) ? v : [];
  const out: CreateRow[] = [];
  for (const r of rows) {
    if (out.length >= max) break;
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const title = cleanText(o.title, 255);
    if (!title) continue;
    out.push({
      title,
      artist_name: cleanText(o.artist_name, 255),
      medium: cleanText(o.medium, 200),
      year: cleanText(o.year, 20),
      dimensions: cleanText(o.dimensions, 100),
      edition: cleanText(o.edition, 100),
      description: cleanText(o.description, 4000),
      value: cleanText(o.value, 50),
      former_owners: cleanLines(o.former_owners).join('\n') || null,
      exhibition_history: cleanLines(o.exhibition_history).join('\n') || null,
      auction_history: cleanLines(o.auction_history).join('\n') || null,
      attachment_id: isUuid(o.attachment_id) ? o.attachment_id : null,
      match: null,
    });
  }
  return out;
}

/** "2004" → "2004-01-01"; full dates pass through; anything else → null. */
export function yearToDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  const m = s.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return m ? `${m[1]}-01-01` : null;
}

/** Applies card edits to a payload. Only fields shown as editable can change. */
export function applyEditsToPayload(
  payload: ProposalPayload,
  preview: ProposalPreview,
  edits: ProposalEdits | undefined,
): ProposalPayload {
  if (!edits) return payload;

  if (payload.kind === 'create_artworks') {
    const selected = Array.isArray(edits.selectedRows)
      ? new Set(edits.selectedRows.filter((i) => Number.isInteger(i)))
      : null;
    const rows = payload.rows
      .map((row, i) => {
        const t = cleanText(edits.rowTitles?.[i], 255);
        return { row: t ? { ...row, title: t } : row, i };
      })
      .filter(({ i }) => (selected ? selected.has(i) : true))
      .map(({ row }) => row);
    return { ...payload, rows };
  }

  const fields = edits.fields ?? {};
  const editable = new Set(preview.changes.filter((c) => c.editable).map((c) => c.key));
  const pick = (key: string) => (editable.has(key) ? fields[key] : undefined);

  if (payload.kind === 'update_provenance') {
    const set = { ...payload.set };
    for (const key of Object.keys(set) as SetField[]) {
      const v = pick(`set.${key}`);
      if (v !== undefined) {
        const clean = cleanText(v, key === 'description' ? 4000 : 255);
        if (clean) set[key] = clean;
        else delete set[key];
      }
    }
    const append = { ...payload.append };
    for (const key of Object.keys(append) as AppendField[]) {
      const v = pick(`append.${key}`);
      if (v !== undefined) {
        const lines = cleanLines(v);
        if (lines.length) append[key] = lines;
        else delete append[key];
      }
    }
    return { ...payload, set, append };
  }

  if (payload.kind === 'provenance_request') {
    const append = { ...payload.append };
    for (const key of Object.keys(append) as AppendField[]) {
      const v = pick(`append.${key}`);
      if (v !== undefined) {
        const lines = cleanLines(v);
        if (lines.length) append[key] = lines;
        else delete append[key];
      }
    }
    const message = cleanText(pick('message'), 1000) ?? payload.message;
    return { ...payload, append, message };
  }

  if (payload.kind === 'add_photo' || payload.kind === 'attach_document') {
    const label = pick('label');
    return label !== undefined ? { ...payload, label: cleanText(label, 200) } : payload;
  }

  if (payload.kind === 'record_sale') {
    const out = { ...payload };
    const buyer = pick('buyer_name');
    if (buyer !== undefined) out.buyer_name = cleanText(buyer, 200);
    const price = pick('price');
    if (price !== undefined) {
      const n = Number(String(price).replace(/[^0-9.]/g, ''));
      out.price = Number.isFinite(n) && n > 0 ? n : null;
    }
    const soldAt = pick('sold_at');
    if (soldAt !== undefined) out.sold_at = cleanText(soldAt, 40);
    return out;
  }

  return payload;
}
