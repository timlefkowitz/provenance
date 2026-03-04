/**
 * Shared types for the grants feature.
 * Used by API routes, server actions, and UI.
 */

export type Grant = {
  id?: string;
  user_id?: string;
  artist_profile_id?: string | null;
  name: string;
  description: string | null;
  deadline: string | null; // ISO date YYYY-MM-DD
  amount: string | null;
  eligible_locations: string[];
  url: string | null;
  discipline: string[];
  source?: string | null;
  raw_response?: unknown;
  created_at?: string;
  updated_at?: string;
};

export type ArtistCvJson = {
  location?: string | null;
  education?: Array<{ institution?: string; degree?: string; year?: string | number }>;
  exhibitions?: Array<{ name?: string; venue?: string; year?: string }>;
  medium?: string | null;
  disciplines?: string[];
  summary?: string | null;
  [key: string]: unknown;
};
