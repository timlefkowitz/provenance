import type { CrmLeadIntel, CrmStakeholder } from './leads-constants';

function linesFromArray(items: string[] | undefined): string {
  return (items ?? []).filter(Boolean).join('\n');
}

function arrayFromLines(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeStakeholders(raw: unknown): CrmStakeholder[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const name = typeof o.name === 'string' ? o.name.trim() : '';
      const role = typeof o.role === 'string' ? o.role.trim() : '';
      const email = typeof o.email === 'string' ? o.email.trim() : '';
      if (!name && !role && !email) return null;
      return { name: name || undefined, role: role || undefined, email: email || undefined };
    })
    .filter(Boolean) as CrmStakeholder[];
}

export function emptyIntel(): CrmLeadIntel {
  return {
    account_name: null,
    current_system_notes: null,
    pain_points: [],
    next_steps: [],
    key_insights: [],
    positives: [],
    negatives: [],
    stakeholders: [],
  };
}

/** Merge DB JSON into a full CrmLeadIntel object. */
export function normalizeIntel(raw: unknown): CrmLeadIntel {
  const base = emptyIntel();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim()) : []);
  return {
    ...base,
    account_name: str(o.account_name) ?? base.account_name,
    current_system_notes: str(o.current_system_notes) ?? base.current_system_notes,
    pain_points: arr(o.pain_points).length ? arr(o.pain_points) : base.pain_points,
    next_steps: arr(o.next_steps).length ? arr(o.next_steps) : base.next_steps,
    key_insights: arr(o.key_insights).length ? arr(o.key_insights) : base.key_insights,
    positives: arr(o.positives).length ? arr(o.positives) : base.positives,
    negatives: arr(o.negatives).length ? arr(o.negatives) : base.negatives,
    stakeholders: normalizeStakeholders(o.stakeholders),
  };
}

export function intelHasContent(i: CrmLeadIntel | null | undefined): boolean {
  if (!i) return false;
  return (
    Boolean(i.account_name?.trim()) ||
    Boolean(i.current_system_notes?.trim()) ||
    (i.pain_points?.length ?? 0) > 0 ||
    (i.next_steps?.length ?? 0) > 0 ||
    (i.key_insights?.length ?? 0) > 0 ||
    (i.positives?.length ?? 0) > 0 ||
    (i.negatives?.length ?? 0) > 0 ||
    (i.stakeholders?.length ?? 0) > 0
  );
}

export function intelSummaryCounts(i: CrmLeadIntel) {
  return {
    pains: i.pain_points?.length ?? 0,
    steps: i.next_steps?.length ?? 0,
    insights: i.key_insights?.length ?? 0,
    people: i.stakeholders?.length ?? 0,
    plus: i.positives?.length ?? 0,
    minus: i.negatives?.length ?? 0,
  };
}

/** Serialize intel for textareas in forms. */
export function intelToFormState(intel: CrmLeadIntel) {
  return {
    account_name: intel.account_name ?? '',
    current_system_notes: intel.current_system_notes ?? '',
    pain_points_text: linesFromArray(intel.pain_points),
    next_steps_text: linesFromArray(intel.next_steps),
    key_insights_text: linesFromArray(intel.key_insights),
    positives_text: linesFromArray(intel.positives),
    negatives_text: linesFromArray(intel.negatives),
    stakeholders:
      intel.stakeholders && intel.stakeholders.length > 0
        ? intel.stakeholders.map((s) => ({
            name: s.name ?? '',
            role: s.role ?? '',
            email: s.email ?? '',
          }))
        : [{ name: '', role: '', email: '' }],
  };
}

export type CrmIntelFormState = ReturnType<typeof intelToFormState>;

export function formStateToIntel(state: CrmIntelFormState): CrmLeadIntel {
  const stakeholders = (state.stakeholders ?? [])
    .map((s) => ({
      name: s.name.trim() || undefined,
      role: s.role.trim() || undefined,
      email: s.email.trim() || undefined,
    }))
    .filter((s) => s.name || s.role || s.email);

  const intel: CrmLeadIntel = {
    account_name: state.account_name.trim() || null,
    current_system_notes: state.current_system_notes.trim() || null,
    pain_points: arrayFromLines(state.pain_points_text),
    next_steps: arrayFromLines(state.next_steps_text),
    key_insights: arrayFromLines(state.key_insights_text),
    positives: arrayFromLines(state.positives_text),
    negatives: arrayFromLines(state.negatives_text),
    stakeholders,
  };

  return intelHasContent(intel) ? intel : emptyIntel();
}
