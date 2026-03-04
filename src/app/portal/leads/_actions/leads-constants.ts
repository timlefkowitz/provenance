export const LEAD_STAGES = ['interested', 'contacted', 'negotiating', 'sold'] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export type ArtistLead = {
  id: string;
  artist_user_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  stage: LeadStage;
  artwork_id: string | null;
  created_at: string;
  updated_at: string;
  artwork?: { id: string; title: string; image_url: string | null } | null;
};

