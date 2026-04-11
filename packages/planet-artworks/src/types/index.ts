import type { BaseAsset } from '@provenance/core/types';

export interface Artwork extends BaseAsset {
  artist_name: string | null;
  artist_account_id: string | null;
  artist_profile_id: string | null;
  gallery_profile_id: string | null;
  creation_date: string | null;
  medium: string | null;
  dimensions: string | null;
  certificate_hash: string | null;
  certificate_type: 'authenticity' | 'show' | 'ownership';
  former_owners: string | null;
  auction_history: string | null;
  exhibition_history: string | null;
  historic_context: string | null;
  celebrity_notes: string | null;
  value: string | null;
  value_is_public: boolean;
  edition: string | null;
  production_location: string | null;
  owned_by: string | null;
  owned_by_is_public: boolean;
  sold_by: string | null;
  sold_by_is_public: boolean;
  is_public: boolean;
  claimed_by_artist_at: string | null;
  verified_by_owner_at: string | null;
  source_artwork_id: string | null;
}

export interface ArtworkCreateInput {
  title: string;
  artist_name?: string;
  medium?: string;
  dimensions?: string;
  creation_date?: string;
  description?: string;
  image_url?: string;
}

export interface ArtworkVerificationContext {
  artwork: Artwork;
  artistConfirmed: boolean;
  ownerConfirmed: boolean;
  galleryAttached: boolean;
  provenanceComplete: boolean;
  duplicateImageDetected: boolean;
}
