export const LEAD_STAGES = ['interested', 'contacted', 'negotiating', 'sold'] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = [
  { value: 'art_fair',    label: 'Art Fair' },
  { value: 'gallery',     label: 'Gallery' },
  { value: 'social_media',label: 'Social Media' },
  { value: 'referral',    label: 'Referral' },
  { value: 'website',     label: 'Website' },
  { value: 'direct',      label: 'Direct' },
  { value: 'other',       label: 'Other' },
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number]['value'];

/** Additional people at the account (beyond the primary lead contact). */
export type CrmStakeholder = {
  name?: string;
  role?: string;
  email?: string;
};

/** Structured deal / meeting brief shown as the “artifact” on CRM cards. */
export type CrmLeadIntel = {
  account_name?: string | null;
  /** e.g. current vs planned CMS / collections tooling */
  current_system_notes?: string | null;
  pain_points?: string[];
  next_steps?: string[];
  key_insights?: string[];
  positives?: string[];
  negatives?: string[];
  stakeholders?: CrmStakeholder[];
};

export type ArtistLead = {
  id: string;
  artist_user_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  stage: LeadStage;
  artwork_id: string | null;
  estimated_value: number | null;
  follow_up_date: string | null;
  source: string | null;
  /** JSON from DB — use normalizeIntel() when reading. */
  intel?: CrmLeadIntel | Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  artwork?: { id: string; title: string; image_url: string | null } | null;
};

export const STAGE_LABELS: Record<LeadStage, string> = {
  interested:  'Interested',
  contacted:   'Contacted',
  negotiating: 'Negotiating',
  sold:        'Sold',
};

/** Tailwind classes (bg, border, text, badge) per stage */
export const STAGE_STYLES: Record<LeadStage, { col: string; badge: string; dot: string }> = {
  interested:  { col: 'bg-sky-50 border-sky-200',    badge: 'bg-sky-100 text-sky-700',     dot: 'bg-sky-400' },
  contacted:   { col: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  negotiating: { col: 'bg-violet-50 border-violet-200', badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-400' },
  sold:        { col: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};
