/**
 * Rules for shows an organiser (gallery or institution) sets up with invited
 * artists:
 *
 * - solo: one artist co-writes the show. They fill in any field the organiser
 *   left for them; fields the organiser filled are locked and the artist asks
 *   for a change instead.
 * - group: selected artists are invited. Each fills in their own part (piece
 *   count, notes, works) and can request changes to the show details.
 * - open_call: any artist submits; the organiser reviews every work.
 *
 * Works from invited artists in solo and group shows go straight into the
 * show. Open calls, and shows made before show types existed, keep review.
 */

export const SHOW_TYPES = ['solo', 'group', 'open_call'] as const;
export type ShowType = (typeof SHOW_TYPES)[number];

export const SHOW_TYPE_LABELS: Record<ShowType, string> = {
  solo: 'Solo show',
  group: 'Group show',
  open_call: 'Open call',
};

export function parseShowType(value: unknown): ShowType | null {
  return SHOW_TYPES.includes(value as ShowType) ? (value as ShowType) : null;
}

/** Show fields an invited artist can fill in or ask to change. */
export const SHOW_FIELDS = [
  'title',
  'description',
  'start_date',
  'end_date',
  'location',
  'image_url',
] as const;
export type ShowField = (typeof SHOW_FIELDS)[number];

export const SHOW_FIELD_LABELS: Record<ShowField, string> = {
  title: 'Title',
  description: 'Description',
  start_date: 'Opening date',
  end_date: 'Closing date',
  location: 'Location',
  image_url: 'Cover image',
};

export function isShowField(value: unknown): value is ShowField {
  return SHOW_FIELDS.includes(value as ShowField);
}

export type FieldSource = 'gallery' | 'artist';
export type FieldSources = Partial<Record<ShowField, FieldSource>>;

export function parseFieldSources(value: unknown): FieldSources {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: FieldSources = {};
  for (const [key, source] of Object.entries(value as Record<string, unknown>)) {
    if (isShowField(key) && (source === 'gallery' || source === 'artist')) out[key] = source;
  }
  return out;
}

export type ShowValues = Partial<Record<ShowField, string | null>>;

/**
 * Field sources for a show the organiser just created: every field they
 * filled is theirs (locked for the artist); blank ones are left open.
 */
export function sourcesForOrganiserValues(values: ShowValues): FieldSources {
  const out: FieldSources = {};
  for (const field of SHOW_FIELDS) {
    const v = values[field];
    if (typeof v === 'string' && v.trim()) out[field] = 'gallery';
  }
  return out;
}

/**
 * After the organiser saves the show form: fields whose value changed become
 * the organiser's; untouched fields keep whoever filled them.
 */
export function sourcesAfterOrganiserEdit(
  current: FieldSources,
  before: ShowValues,
  after: ShowValues,
): FieldSources {
  const out: FieldSources = { ...current };
  for (const field of SHOW_FIELDS) {
    if (!(field in after)) continue;
    const prev = normalizeLoose(before[field]);
    const next = normalizeLoose(after[field]);
    if (prev === next) continue;
    if (next) out[field] = 'gallery';
    else delete out[field];
  }
  return out;
}

function normalizeLoose(v: string | null | undefined): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Whether an invited artist may change this field directly. */
export function canArtistEditField(params: {
  canEditShow: boolean;
  fieldSources: FieldSources;
  field: ShowField;
}): boolean {
  return params.canEditShow && params.fieldSources[params.field] !== 'gallery';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LENGTHS: Record<ShowField, number> = {
  title: 255,
  description: 10000,
  start_date: 10,
  end_date: 10,
  location: 500,
  image_url: 2000,
};

/**
 * Cleans one field value. Returns the value to store (null clears it) or an
 * error. Title and opening date can't be cleared: every show needs them.
 */
export function normalizeShowFieldValue(
  field: ShowField,
  raw: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const label = SHOW_FIELD_LABELS[field];
  if (raw !== null && raw !== undefined && typeof raw !== 'string') {
    return { ok: false, error: `${label} must be text` };
  }
  const value = (raw ?? '').trim();

  if (!value) {
    if (field === 'title' || field === 'start_date') {
      return { ok: false, error: `${label} can't be empty` };
    }
    return { ok: true, value: null };
  }
  if (value.length > MAX_LENGTHS[field]) {
    return { ok: false, error: `${label} is too long` };
  }
  if ((field === 'start_date' || field === 'end_date') && !isValidDate(value)) {
    return { ok: false, error: `${label} must be a date (YYYY-MM-DD)` };
  }
  if (field === 'image_url' && !/^https:\/\//i.test(value)) {
    return { ok: false, error: `${label} must be an https link` };
  }
  return { ok: true, value };
}

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Closing date must not be before the opening date. */
export function checkDateOrder(startDate: string | null, endDate: string | null): string | null {
  if (startDate && endDate && endDate < startDate) {
    return 'The closing date is before the opening date';
  }
  return null;
}

export type ArtistEditPlan =
  | { ok: true; updates: ShowValues; fieldSources: FieldSources; changed: ShowField[] }
  | { ok: false; error: string; lockedFields?: ShowField[] };

/**
 * What an invited artist's edit to the show writes. Rejects the whole edit if
 * it touches a field the organiser filled (those go through a change request)
 * or if the artist may not edit the show at all (group shows).
 */
export function planArtistShowEdit(params: {
  canEditShow: boolean;
  fieldSources: FieldSources;
  current: ShowValues;
  patch: Record<string, unknown>;
}): ArtistEditPlan {
  if (!params.canEditShow) {
    return { ok: false, error: 'The organiser manages this show’s details; send a change request instead' };
  }

  const updates: ShowValues = {};
  const changed: ShowField[] = [];
  const locked: ShowField[] = [];

  for (const [key, raw] of Object.entries(params.patch)) {
    if (!isShowField(key)) return { ok: false, error: `Unknown field: ${key}` };
    const normalized = normalizeShowFieldValue(key, raw);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    if (normalizeLoose(params.current[key]) === (normalized.value ?? '')) continue;
    if (!canArtistEditField({ canEditShow: true, fieldSources: params.fieldSources, field: key })) {
      locked.push(key);
      continue;
    }
    updates[key] = normalized.value;
    changed.push(key);
  }

  if (locked.length > 0) {
    return {
      ok: false,
      error: `${locked.map((f) => SHOW_FIELD_LABELS[f]).join(', ')} ${locked.length === 1 ? 'was' : 'were'} set by the organiser; request a change instead`,
      lockedFields: locked,
    };
  }

  const start = 'start_date' in updates ? updates.start_date ?? null : params.current.start_date ?? null;
  const end = 'end_date' in updates ? updates.end_date ?? null : params.current.end_date ?? null;
  const dateError = checkDateOrder(start, end);
  if (dateError) return { ok: false, error: dateError };

  const fieldSources: FieldSources = { ...params.fieldSources };
  for (const field of changed) {
    if (updates[field]) fieldSources[field] = 'artist';
    else delete fieldSources[field];
  }

  return { ok: true, updates, fieldSources, changed };
}

/**
 * Applying an approved change request: the value is written and the field
 * stays the organiser's (they approved it).
 */
export function planApprovedChange(params: {
  field: ShowField;
  proposed: unknown;
  current: ShowValues;
  fieldSources: FieldSources;
}):
  | { ok: true; updates: ShowValues; fieldSources: FieldSources }
  | { ok: false; error: string } {
  const normalized = normalizeShowFieldValue(params.field, params.proposed);
  if (!normalized.ok) return normalized;

  const start = params.field === 'start_date' ? normalized.value : params.current.start_date ?? null;
  const end = params.field === 'end_date' ? normalized.value : params.current.end_date ?? null;
  const dateError = checkDateOrder(start, end);
  if (dateError) return { ok: false, error: dateError };

  const fieldSources: FieldSources = { ...params.fieldSources };
  if (normalized.value) fieldSources[params.field] = 'gallery';
  else delete fieldSources[params.field];

  return { ok: true, updates: { [params.field]: normalized.value }, fieldSources };
}

/**
 * Whether work an invited artist adds goes straight into the show. Only for
 * organiser invites to solo and group shows; open calls and older shows keep
 * review.
 */
export function invitedWorkGoesStraightIn(showType: unknown, inviteSource: unknown): boolean {
  const type = parseShowType(showType);
  return inviteSource === 'invite' && (type === 'solo' || type === 'group');
}

/** Invite statuses that still let the artist in. */
export const OPEN_INVITE_STATUSES = ['pending', 'sent', 'accepted'] as const;

/**
 * Accepted invites to solo and group shows stay open for the life of the show
 * (the artist keeps adding work and editing details). Other invites are used
 * up by the first submission, as before.
 */
export function inviteStaysOpenAfterSubmission(showType: unknown, inviteSource: unknown): boolean {
  return invitedWorkGoesStraightIn(showType, inviteSource);
}

/** Planned piece count from a form value: whole number 0-1000, or null. */
export function parsePlannedPieceCount(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n < 0 || n > 1000) return 'invalid';
  return n;
}
